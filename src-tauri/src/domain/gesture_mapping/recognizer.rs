use crate::domain::profile::GesturePoint;

const TEMPLATE_SIZE: usize = 64;
const SQUARE_SIZE: f64 = 250.0;

fn path_length(points: &[GesturePoint]) -> f64 {
    let mut length = 0.0;
    for index in 1..points.len() {
        let dx = points[index].x - points[index - 1].x;
        let dy = points[index].y - points[index - 1].y;
        length += (dx * dx + dy * dy).sqrt();
    }
    length
}

fn resample(points: &[GesturePoint], count: usize) -> Vec<GesturePoint> {
    if points.is_empty() {
        return Vec::new();
    }
    let interval = path_length(points) / (count as f64 - 1.0);
    let mut distance = 0.0;
    let mut next = vec![points[0].clone()];
    for index in 1..points.len() {
        let prev = &points[index - 1];
        let current = &points[index];
        let dx = current.x - prev.x;
        let dy = current.y - prev.y;
        let segment = (dx * dx + dy * dy).sqrt();
        if segment <= f64::EPSILON {
            continue;
        }
        while distance + segment >= interval {
            let ratio = (interval - distance) / segment;
            next.push(GesturePoint {
                x: prev.x + ratio * dx,
                y: prev.y + ratio * dy,
            });
            distance = 0.0;
        }
        distance += segment;
    }
    while next.len() < count {
        next.push(points[points.len() - 1].clone());
    }
    next.truncate(count);
    next
}

fn centroid(points: &[GesturePoint]) -> GesturePoint {
    let mut x = 0.0;
    let mut y = 0.0;
    for point in points {
        x += point.x;
        y += point.y;
    }
    let n = points.len() as f64;
    GesturePoint { x: x / n, y: y / n }
}

fn translate_to(points: &[GesturePoint], origin: &GesturePoint) -> Vec<GesturePoint> {
    points
        .iter()
        .map(|point| GesturePoint {
            x: point.x - origin.x,
            y: point.y - origin.y,
        })
        .collect()
}

fn scale_to(points: &[GesturePoint], size: f64) -> Vec<GesturePoint> {
    let mut min_x = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    for point in points {
        min_x = min_x.min(point.x);
        max_x = max_x.max(point.x);
        min_y = min_y.min(point.y);
        max_y = max_y.max(point.y);
    }
    let width = max_x - min_x;
    let height = max_y - min_y;
    let scale = size / width.max(height);
    points
        .iter()
        .map(|point| GesturePoint {
            x: point.x * scale,
            y: point.y * scale,
        })
        .collect()
}

fn indicative_angle(points: &[GesturePoint]) -> f64 {
    let start = &points[0];
    let end = &points[points.len() / 2];
    (end.y - start.y).atan2(end.x - start.x)
}

fn rotate_by(points: &[GesturePoint], radians: f64) -> Vec<GesturePoint> {
    let cos = radians.cos();
    let sin = radians.sin();
    points
        .iter()
        .map(|point| GesturePoint {
            x: point.x * cos - point.y * sin,
            y: point.x * sin + point.y * cos,
        })
        .collect()
}

pub fn normalize_template(points: &[GesturePoint]) -> Vec<GesturePoint> {
    if points.is_empty() {
        return Vec::new();
    }
    let mut next = resample(points, TEMPLATE_SIZE);
    next = rotate_by(&next, -indicative_angle(&next));
    next = scale_to(&next, SQUARE_SIZE);
    next = translate_to(&next, &centroid(&next));
    next
}

fn vectorize(points: &[GesturePoint]) -> Vec<f64> {
    let mut values = Vec::with_capacity(points.len() * 2);
    for point in points {
        values.push(point.x);
        values.push(point.y);
    }
    values
}

fn angle_distance_at(candidate: &[f64], template: &[f64], angle: f64) -> f64 {
    let cos = angle.cos();
    let sin = angle.sin();
    let mut sum = 0.0;
    for index in (0..candidate.len()).step_by(2) {
        let x = candidate[index] * cos - candidate[index + 1] * sin;
        let y = candidate[index] * sin + candidate[index + 1] * cos;
        let dx = template[index] - x;
        let dy = template[index + 1] - y;
        sum += dx * dx + dy * dy;
    }
    sum
}

fn optimal_angle(candidate: &[f64], template: &[f64]) -> f64 {
    let mut a = -std::f64::consts::FRAC_PI_4;
    let mut b = std::f64::consts::FRAC_PI_4;
    let delta = std::f64::consts::PI / 90.0;
    let mut x1 = a + (b - a) / 3.0;
    let mut f1 = angle_distance_at(candidate, template, x1);
    let mut x2 = b - (b - a) / 3.0;
    let mut f2 = angle_distance_at(candidate, template, x2);
    while (b - a).abs() > delta {
        if f1 < f2 {
            b = x2;
            x2 = x1;
            f2 = f1;
            x1 = a + (b - a) / 3.0;
            f1 = angle_distance_at(candidate, template, x1);
        } else {
            a = x1;
            x1 = x2;
            f1 = f2;
            x2 = b - (b - a) / 3.0;
            f2 = angle_distance_at(candidate, template, x2);
        }
    }
    (a + b) / 2.0
}

pub fn match_score(candidate_raw: &[GesturePoint], template: &[GesturePoint]) -> f64 {
    if candidate_raw.len() < 2 || template.len() < 2 {
        return 0.0;
    }
    let candidate = normalize_template(candidate_raw);
    let candidate_vector = vectorize(&candidate);
    let template_vector = vectorize(template);
    let angle = optimal_angle(&candidate_vector, &template_vector);
    let cos = angle.cos();
    let sin = angle.sin();
    let mut sum = 0.0;
    for index in (0..candidate_vector.len()).step_by(2) {
        let x = candidate_vector[index] * cos - candidate_vector[index + 1] * sin;
        let y = candidate_vector[index] * sin + candidate_vector[index + 1] * cos;
        let dx = template_vector[index] - x;
        let dy = template_vector[index + 1] - y;
        sum += dx * dx + dy * dy;
    }
    let half_diagonal = 0.5 * (SQUARE_SIZE * SQUARE_SIZE * 2.0).sqrt();
    let max_distance = (candidate_vector.len() as f64 / 2.0) * half_diagonal;
    (1.0 - sum / (max_distance * max_distance)).clamp(0.0, 1.0)
}

pub fn raw_path_length(points: &[GesturePoint]) -> f64 {
    path_length(points)
}

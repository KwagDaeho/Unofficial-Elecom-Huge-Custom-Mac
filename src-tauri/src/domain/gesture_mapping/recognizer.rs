use crate::domain::profile::GesturePoint;

const TEMPLATE_SIZE: usize = 64;
const SQUARE_SIZE: f64 = 250.0;
pub const MIN_PATH_LENGTH_RATIO: f64 = 0.68;
pub const MIN_TURNING_RATIO: f64 = 0.55;
pub const MIN_TEMPLATE_TURNING: f64 = 0.35;

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
    if points.len() == 1 {
        return vec![points[0].clone(); count];
    }
    let total_length = path_length(points);
    let interval = total_length / (count as f64 - 1.0);
    if interval <= f64::EPSILON {
        return vec![points[points.len() - 1].clone(); count];
    }

    let mut next = vec![points[0].clone()];
    let mut carried = 0.0;
    let mut index = 1;

    while index < points.len() && next.len() < count {
        let start = &points[index - 1];
        let end = &points[index];
        let mut dx = end.x - start.x;
        let mut dy = end.y - start.y;
        let mut segment = (dx * dx + dy * dy).sqrt();

        if segment <= f64::EPSILON {
            index += 1;
            continue;
        }

        while carried + segment >= interval && next.len() < count {
            let t = (interval - carried) / segment;
            let sx = start.x + t * dx;
            let sy = start.y + t * dy;
            next.push(GesturePoint { x: sx, y: sy });
            dx = end.x - sx;
            dy = end.y - sy;
            segment = (dx * dx + dy * dy).sqrt();
            carried = 0.0;
        }

        carried += segment;
        index += 1;
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

pub fn path_turning(points: &[GesturePoint]) -> f64 {
    if points.len() < 3 {
        return 0.0;
    }
    let mut turning = 0.0;
    for index in 2..points.len() {
        let v1x = points[index - 1].x - points[index - 2].x;
        let v1y = points[index - 1].y - points[index - 2].y;
        let v2x = points[index].x - points[index - 1].x;
        let v2y = points[index].y - points[index - 1].y;
        let l1 = (v1x * v1x + v1y * v1y).sqrt();
        let l2 = (v2x * v2x + v2y * v2y).sqrt();
        if l1 <= f64::EPSILON || l2 <= f64::EPSILON {
            continue;
        }
        let dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
        turning += dot.clamp(-1.0, 1.0).acos();
    }
    turning
}

pub fn passes_shape_checks(
    candidate_raw: &[GesturePoint],
    template: &[GesturePoint],
    template_path_length: f64,
) -> bool {
    if template_path_length > f64::EPSILON {
        let ratio = path_length(candidate_raw) / template_path_length;
        if ratio < MIN_PATH_LENGTH_RATIO {
            return false;
        }
    }

    let template_turning = path_turning(template);
    if template_turning >= MIN_TEMPLATE_TURNING {
        let candidate_turning = path_turning(&normalize_template(candidate_raw));
        if candidate_turning / template_turning < MIN_TURNING_RATIO {
            return false;
        }
    }

    true
}

fn vectorize(points: &[GesturePoint]) -> Vec<f64> {
    let mut values = Vec::with_capacity(points.len() * 2);
    for point in points {
        values.push(point.x);
        values.push(point.y);
    }
    values
}

pub fn match_score(candidate_raw: &[GesturePoint], template: &[GesturePoint]) -> f64 {
    if candidate_raw.len() < 2 || template.len() < 2 {
        return 0.0;
    }
    let candidate = normalize_template(candidate_raw);
    let candidate_vector = vectorize(&candidate);
    let template_vector = vectorize(template);
    let mut sum = 0.0;
    for index in (0..candidate_vector.len()).step_by(2) {
        let dx = template_vector[index] - candidate_vector[index];
        let dy = template_vector[index + 1] - candidate_vector[index + 1];
        sum += dx * dx + dy * dy;
    }
    let half_diagonal = 0.5 * (SQUARE_SIZE * SQUARE_SIZE * 2.0).sqrt();
    let max_distance = (candidate_vector.len() as f64 / 2.0) * half_diagonal;
    (1.0 - sum / (max_distance * max_distance)).clamp(0.0, 1.0)
}

pub fn raw_path_length(points: &[GesturePoint]) -> f64 {
    path_length(points)
}

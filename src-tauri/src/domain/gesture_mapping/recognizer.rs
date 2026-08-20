use crate::domain::profile::GesturePoint;

const TEMPLATE_SIZE: usize = 64;
const SQUARE_SIZE: f64 = 250.0;
pub const MIN_PATH_LENGTH_RATIO: f64 = 0.75;
pub const MIN_TURNING_RATIO: f64 = 0.85;
pub const MIN_TEMPLATE_TURNING: f64 = 0.35;
const MIN_CORNER_ANGLE: f64 = std::f64::consts::PI / 5.0;
const SIMPLIFY_EPSILON_RATIO: f64 = 0.04;
const MIN_SIMPLIFY_EPSILON: f64 = 3.0;
const MAX_CORNER_COUNT_DIFF_RATIO: f64 = 0.25;
const MIN_CORNER_AXIS_RATIO: f64 = 0.28;
pub const MAX_BEARING_DELTA: f64 = std::f64::consts::PI / 3.0;

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

pub fn normalize_template(points: &[GesturePoint]) -> Vec<GesturePoint> {
    if points.is_empty() {
        return Vec::new();
    }
    let mut next = resample(points, TEMPLATE_SIZE);
    next = scale_to(&next, SQUARE_SIZE);
    next = translate_to(&next, &centroid(&next));
    next
}

fn bounding_diagonal(points: &[GesturePoint]) -> f64 {
    if points.is_empty() {
        return 0.0;
    }
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
    (max_x - min_x).hypot(max_y - min_y)
}

fn perpendicular_distance(
    point: &GesturePoint,
    line_start: &GesturePoint,
    line_end: &GesturePoint,
) -> f64 {
    let dx = line_end.x - line_start.x;
    let dy = line_end.y - line_start.y;
    let length_sq = dx * dx + dy * dy;
    if length_sq <= f64::EPSILON {
        return (point.x - line_start.x).hypot(point.y - line_start.y);
    }
    let t = (((point.x - line_start.x) * dx + (point.y - line_start.y) * dy) / length_sq).clamp(0.0, 1.0);
    let proj_x = line_start.x + t * dx;
    let proj_y = line_start.y + t * dy;
    (point.x - proj_x).hypot(point.y - proj_y)
}

pub fn simplify_gesture_path(points: &[GesturePoint]) -> Vec<GesturePoint> {
    if points.len() <= 2 {
        return points.to_vec();
    }
    let epsilon = MIN_SIMPLIFY_EPSILON.max(bounding_diagonal(points) * SIMPLIFY_EPSILON_RATIO);

    fn simplify(segment: &[GesturePoint], epsilon: f64) -> Vec<GesturePoint> {
        if segment.len() <= 2 {
            return segment.to_vec();
        }
        let start = &segment[0];
        let end = &segment[segment.len() - 1];
        let mut max_distance = 0.0;
        let mut split_index = 0;
        for index in 1..segment.len() - 1 {
            let distance = perpendicular_distance(&segment[index], start, end);
            if distance > max_distance {
                max_distance = distance;
                split_index = index;
            }
        }
        if max_distance <= epsilon {
            return vec![start.clone(), end.clone()];
        }
        let mut left = simplify(&segment[..=split_index], epsilon);
        let right = simplify(&segment[split_index..], epsilon);
        left.pop();
        left.extend(right);
        left
    }

    simplify(points, epsilon)
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

pub fn sharp_turn_count(points: &[GesturePoint]) -> usize {
    if points.len() < 3 {
        return 0;
    }
    let mut count = 0;
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
        let angle = dot.clamp(-1.0, 1.0).acos();
        if angle >= MIN_CORNER_ANGLE {
            count += 1;
        }
    }
    count
}

pub fn significant_corner_count(points: &[GesturePoint]) -> usize {
    sharp_turn_count(&simplify_gesture_path(points))
}

pub fn path_bend_signature(points: &[GesturePoint]) -> i64 {
    let simplified = simplify_gesture_path(points);
    if simplified.len() < 3 {
        return 0;
    }
    let mut signature = 0_i64;
    for index in 2..simplified.len() {
        let v1x = simplified[index - 1].x - simplified[index - 2].x;
        let v1y = simplified[index - 1].y - simplified[index - 2].y;
        let v2x = simplified[index].x - simplified[index - 1].x;
        let v2y = simplified[index].y - simplified[index - 1].y;
        let l1 = (v1x * v1x + v1y * v1y).sqrt();
        let l2 = (v2x * v2x + v2y * v2y).sqrt();
        if l1 <= f64::EPSILON || l2 <= f64::EPSILON {
            continue;
        }
        let dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
        let angle = dot.clamp(-1.0, 1.0).acos();
        if angle >= MIN_CORNER_ANGLE {
            let cross = v1x * v2y - v1y * v2x;
            signature += cross.signum() as i64;
        }
    }
    signature
}

fn start_end_bearing(points: &[GesturePoint]) -> Option<f64> {
    if points.len() < 2 {
        return None;
    }
    let start = &points[0];
    let end = &points[points.len() - 1];
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    if dx.hypot(dy) < 1.0 {
        return None;
    }
    Some(dy.atan2(dx))
}

fn bearing_delta(left: f64, right: f64) -> f64 {
    let mut diff = (left - right).abs();
    if diff > std::f64::consts::PI {
        diff = 2.0 * std::f64::consts::PI - diff;
    }
    diff
}

fn corner_count_tolerance(expected: usize) -> usize {
    if expected <= 1 {
        0
    } else {
        ((expected as f64) * MAX_CORNER_COUNT_DIFF_RATIO)
            .ceil()
            .max(1.0) as usize
    }
}

struct PathBBox {
    width: f64,
    height: f64,
}

fn path_bbox(points: &[GesturePoint]) -> PathBBox {
    if points.is_empty() {
        return PathBBox {
            width: 0.0,
            height: 0.0,
        };
    }
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
    PathBBox {
        width: max_x - min_x,
        height: max_y - min_y,
    }
}

fn passes_axis_shape_check(
    candidate_raw: &[GesturePoint],
    template: &[GesturePoint],
    expected_corner_count: usize,
) -> bool {
    if expected_corner_count < 1 {
        return true;
    }
    let template_box = path_bbox(&simplify_gesture_path(template));
    let candidate_box = path_bbox(&simplify_gesture_path(candidate_raw));
    let template_long = template_box.width.max(template_box.height);
    let template_short = template_box.width.min(template_box.height);
    let candidate_long = candidate_box.width.max(candidate_box.height);
    let candidate_short = candidate_box.width.min(candidate_box.height);
    if template_long <= f64::EPSILON || candidate_long <= f64::EPSILON {
        return true;
    }
    let template_aspect = template_short / template_long;
    let candidate_aspect = candidate_short / candidate_long;
    if template_aspect >= 0.18 && candidate_aspect < template_aspect * MIN_CORNER_AXIS_RATIO {
        return false;
    }
    true
}

struct ExpectedShapeMetadata {
    corner_count: usize,
    bend_signature: i64,
}

fn expected_shape_metadata(
    template: &[GesturePoint],
    template_corner_count: usize,
    template_bend_signature: i64,
) -> ExpectedShapeMetadata {
    ExpectedShapeMetadata {
        corner_count: if template_corner_count > 0 {
            template_corner_count
        } else {
            significant_corner_count(template)
        },
        bend_signature: if template_bend_signature != 0 {
            template_bend_signature
        } else {
            path_bend_signature(template)
        },
    }
}

fn shape_compatibility_penalty(
    candidate_raw: &[GesturePoint],
    template: &[GesturePoint],
    template_corner_count: usize,
    template_bend_signature: i64,
) -> f64 {
    let expected = expected_shape_metadata(template, template_corner_count, template_bend_signature);

    if expected.corner_count >= 1 {
        let candidate_corners = significant_corner_count(candidate_raw);
        let max_diff = corner_count_tolerance(expected.corner_count);
        if candidate_corners + max_diff < expected.corner_count {
            return 0.5;
        }
        if candidate_corners.abs_diff(expected.corner_count) > max_diff {
            return 0.5;
        }
    }

    if expected.bend_signature != 0 {
        let candidate_signature = path_bend_signature(candidate_raw);
        if candidate_signature == 0
            || expected.bend_signature.signum() != candidate_signature.signum()
        {
            return 0.5;
        }
    }

    if !passes_axis_shape_check(candidate_raw, template, expected.corner_count) {
        return 0.5;
    }

    if let (Some(template_bearing), Some(candidate_bearing)) = (
        start_end_bearing(template),
        start_end_bearing(&normalize_template(candidate_raw)),
    ) {
        if bearing_delta(template_bearing, candidate_bearing) > MAX_BEARING_DELTA {
            return 0.5;
        }
    }

    1.0
}

pub fn passes_shape_checks(
    candidate_raw: &[GesturePoint],
    template: &[GesturePoint],
    template_path_length: f64,
    template_corner_count: usize,
    template_bend_signature: i64,
) -> bool {
    if template_path_length > f64::EPSILON {
        let ratio = path_length(candidate_raw) / template_path_length;
        if ratio < MIN_PATH_LENGTH_RATIO {
            return false;
        }
    }

    let expected = expected_shape_metadata(template, template_corner_count, template_bend_signature);
    let template_simplified = simplify_gesture_path(template);
    let candidate_simplified = simplify_gesture_path(candidate_raw);

    let template_turning = path_turning(&template_simplified);
    if template_turning >= MIN_TEMPLATE_TURNING {
        let candidate_turning = path_turning(&candidate_simplified);
        if candidate_turning / template_turning < MIN_TURNING_RATIO {
            return false;
        }
    }

    if expected.corner_count >= 1 {
        let candidate_corners = significant_corner_count(candidate_raw);
        let max_diff = corner_count_tolerance(expected.corner_count);
        if candidate_corners + max_diff < expected.corner_count {
            return false;
        }
        if candidate_corners.abs_diff(expected.corner_count) > max_diff {
            return false;
        }
    }

    if expected.bend_signature != 0 {
        let candidate_signature = path_bend_signature(candidate_raw);
        if candidate_signature == 0
            || expected.bend_signature.signum() != candidate_signature.signum()
        {
            return false;
        }
    }

    if !passes_axis_shape_check(candidate_raw, template, expected.corner_count) {
        return false;
    }

    if let (Some(template_bearing), Some(candidate_bearing)) = (
        start_end_bearing(template),
        start_end_bearing(&normalize_template(candidate_raw)),
    ) {
        if bearing_delta(template_bearing, candidate_bearing) > MAX_BEARING_DELTA {
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

pub fn match_score(
    candidate_raw: &[GesturePoint],
    template: &[GesturePoint],
    template_corner_count: usize,
    template_bend_signature: i64,
) -> f64 {
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
    let point_score = (1.0 - sum / (max_distance * max_distance)).clamp(0.0, 1.0);
    point_score
        * shape_compatibility_penalty(
            candidate_raw,
            template,
            template_corner_count,
            template_bend_signature,
        )
}

pub fn raw_path_length(points: &[GesturePoint]) -> f64 {
    path_length(points)
}

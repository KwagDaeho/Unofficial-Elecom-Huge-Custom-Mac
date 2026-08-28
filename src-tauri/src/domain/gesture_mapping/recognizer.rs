use guessture::{find_matching_template, Path2D, Template};

use crate::domain::profile::{GestureMappingEntry, GesturePoint};

use super::vector::{resolve_entry_vector, vector_to_preview_points};

pub const MIN_RAW_PATH_LENGTH: f64 = 24.0;
pub const DEFAULT_GESTURE_MIN_SCORE: f64 = 0.72;
/// guessture rejects paths shorter than this before normalization.
const GUESSTURE_MIN_PATH: f32 = 100.0;
/// Allow slight rotation while keeping overall stroke orientation meaningful.
const MATCH_ANGLE_RANGE: f32 = 15.0;
const MATCH_ANGLE_PRECISION: f32 = 2.0;

fn path_length(points: &[GesturePoint]) -> f64 {
    let mut length = 0.0;
    for index in 1..points.len() {
        let dx = points[index].x - points[index - 1].x;
        let dy = points[index].y - points[index - 1].y;
        length += (dx * dx + dy * dy).sqrt();
    }
    length
}

pub fn raw_path_length(points: &[GesturePoint]) -> f64 {
    path_length(points)
}

fn ensure_non_degenerate_bbox(points: &mut [GesturePoint]) {
    if points.len() < 2 {
        return;
    }
    let mut min_x = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    for point in points.iter() {
        min_x = min_x.min(point.x);
        max_x = max_x.max(point.x);
        min_y = min_y.min(point.y);
        max_y = max_y.max(point.y);
    }
    let last = points.len() - 1;
    if (max_x - min_x).abs() < 1e-3 {
        points[last].x += 0.01;
    }
    if (max_y - min_y).abs() < 1e-3 {
        points[last].y += 0.01;
    }
}

fn points_to_path(points: &[GesturePoint]) -> Path2D {
    let mut stable = points.to_vec();
    ensure_non_degenerate_bbox(&mut stable);
    let mut path = Path2D::default();
    for point in stable {
        let x = point.x as f32;
        let y = point.y as f32;
        if path.is_new_point(x, y) {
            path.push(x, y);
        }
    }
    path
}

/// Uniform scale so guessture's internal minimum-length gate passes. $1 is scale-invariant.
fn scale_for_matcher(points: &[GesturePoint]) -> Vec<GesturePoint> {
    let length = path_length(points);
    if length >= GUESSTURE_MIN_PATH as f64 || length <= f64::EPSILON {
        return points.to_vec();
    }
    let scale = GUESSTURE_MIN_PATH as f64 / length;
    points
        .iter()
        .map(|point| GesturePoint {
            x: point.x * scale,
            y: point.y * scale,
        })
        .collect()
}

pub fn resolve_template_points(entry: &GestureMappingEntry) -> Vec<GesturePoint> {
    if entry.template.len() >= 2 {
        return entry.template.clone();
    }
    let vector = resolve_entry_vector(entry);
    if vector.directions.is_empty() {
        return Vec::new();
    }
    vector_to_preview_points(&vector, 250.0)
}

fn build_template(id: &str, points: &[GesturePoint]) -> Option<Template> {
    if points.len() < 2 {
        return None;
    }
    let path = points_to_path(points);
    Template::new(id.to_string(), &path).ok()
}

pub fn match_score(candidate: &[GesturePoint], template_points: &[GesturePoint]) -> Option<f32> {
    if candidate.len() < 2 || template_points.len() < 2 {
        return None;
    }
    if raw_path_length(candidate) < MIN_RAW_PATH_LENGTH {
        return None;
    }
    let template = build_template("template", template_points)?;
    let scaled = scale_for_matcher(candidate);
    let path = points_to_path(&scaled);
    let templates = [template];
    find_matching_template(&templates, &path, MATCH_ANGLE_RANGE, MATCH_ANGLE_PRECISION)
        .ok()
        .map(|(_, score)| score)
}

pub fn best_match<'a>(
    candidate: &[GesturePoint],
    entries: &'a [GestureMappingEntry],
) -> Option<(&'a GestureMappingEntry, f32)> {
    if raw_path_length(candidate) < MIN_RAW_PATH_LENGTH {
        return None;
    }
    let scaled = scale_for_matcher(candidate);
    let path = points_to_path(&scaled);

    let mut best: Option<(&GestureMappingEntry, f32)> = None;
    for entry in entries {
        let template_points = resolve_template_points(entry);
        let Some(template) = build_template(&entry.id, &template_points) else {
            continue;
        };
        let templates = [template];
        let Ok((_, score)) =
            find_matching_template(&templates, &path, MATCH_ANGLE_RANGE, MATCH_ANGLE_PRECISION)
        else {
            continue;
        };
        let threshold = entry.min_score.min(DEFAULT_GESTURE_MIN_SCORE) as f32;
        if score < threshold {
            continue;
        }
        if best
            .map(|(_, current)| score > current)
            .unwrap_or(true)
        {
            best = Some((entry, score));
        }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(steps: usize, dx: f64, dy: f64) -> Vec<GesturePoint> {
        (0..=steps)
            .map(|index| GesturePoint {
                x: index as f64 * dx,
                y: index as f64 * dy,
            })
            .collect()
    }

    #[test]
    fn matches_similar_line_at_different_scale() {
        let template = line(20, 8.0, 0.0);
        let candidate = line(20, 4.0, 0.0);
        let score = match_score(&candidate, &template).unwrap_or(0.0);
        assert!(score >= 0.72, "score={score}");
    }
}

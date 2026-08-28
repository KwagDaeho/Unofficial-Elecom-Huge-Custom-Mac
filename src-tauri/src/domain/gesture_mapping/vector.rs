use crate::domain::profile::{GestureMappingEntry, GesturePoint};

pub const MIN_RAW_PATH_LENGTH: f64 = 24.0;
pub const MIN_PATH_LENGTH_RATIO: f64 = 0.65;
pub const MIN_VECTOR_SEGMENT_LENGTH: f64 = 4.0;
pub const MIN_SEGMENT_LENGTH_RATIO: f64 = 0.08;
pub const DIRECTION_SCORE_WEIGHT: f64 = 0.55;
pub const LENGTH_SCORE_WEIGHT: f64 = 0.45;
pub const ADJACENT_DIRECTION_MATCH_SCORE: f64 = 0.95;
pub const LENGTH_RATIO_TOLERANCE: f64 = 1.05;
pub const MIN_GESTURE_SEGMENTS: usize = 1;
pub const DEFAULT_GESTURE_MIN_SCORE: f64 = 0.62;

#[derive(Debug, Clone, PartialEq)]
pub struct GestureVector {
    pub directions: Vec<u8>,
    pub segment_lengths: Vec<f64>,
    pub total_length: f64,
}

impl GestureVector {
    fn empty() -> Self {
        Self {
            directions: Vec::new(),
            segment_lengths: Vec::new(),
            total_length: 0.0,
        }
    }
}

pub fn quantize_direction(dx: f64, dy: f64) -> u8 {
    let angle = (-dy).atan2(dx);
    let normalized = (angle + std::f64::consts::TAU) % std::f64::consts::TAU;
    (normalized / (std::f64::consts::PI / 4.0)).round() as u8 % 8
}

pub fn directions_compatible(left: u8, right: u8) -> bool {
    if left == right {
        return true;
    }
    let diff = left.abs_diff(right);
    diff <= 1 || diff == 7
}

pub fn is_cardinal_direction(direction: u8) -> bool {
    direction.is_multiple_of(2)
}

fn direction_unit_vector(direction: u8) -> (f64, f64) {
    let angle = f64::from(direction) * (std::f64::consts::PI / 4.0);
    (angle.cos(), -angle.sin())
}

fn path_length(points: &[GesturePoint]) -> f64 {
    let mut length = 0.0;
    for index in 1..points.len() {
        let dx = points[index].x - points[index - 1].x;
        let dy = points[index].y - points[index - 1].y;
        length += (dx * dx + dy * dy).sqrt();
    }
    length
}

pub fn extract_gesture_vector(points: &[GesturePoint]) -> GestureVector {
    if points.len() < 2 {
        return GestureVector::empty();
    }

    let mut directions = Vec::new();
    let mut raw_lengths = Vec::new();

    for index in 1..points.len() {
        let dx = points[index].x - points[index - 1].x;
        let dy = points[index].y - points[index - 1].y;
        let segment = (dx * dx + dy * dy).sqrt();
        if segment <= f64::EPSILON {
            continue;
        }
        let direction = quantize_direction(dx, dy);
        let last_direction = directions.last().copied();

        if last_direction.is_none() {
            directions.push(direction);
            raw_lengths.push(segment);
            continue;
        }

        if last_direction == Some(direction) {
            if let Some(last) = raw_lengths.last_mut() {
                *last += segment;
            }
            continue;
        }

        if segment < MIN_VECTOR_SEGMENT_LENGTH
            && directions_compatible(last_direction.unwrap(), direction)
        {
            if let Some(last) = raw_lengths.last_mut() {
                *last += segment;
            }
            continue;
        }

        directions.push(direction);
        raw_lengths.push(segment);
    }

    let total_length: f64 = raw_lengths.iter().sum();
    if directions.is_empty() || total_length <= f64::EPSILON {
        return GestureVector::empty();
    }

    GestureVector {
        directions,
        segment_lengths: raw_lengths
            .iter()
            .map(|value| value / total_length)
            .collect(),
        total_length,
    }
}

pub fn normalize_gesture_vector(vector: &GestureVector) -> GestureVector {
    if vector.directions.is_empty() {
        return vector.clone();
    }

    let mut directions = vector.directions.clone();
    let mut lengths = vector
        .segment_lengths
        .iter()
        .map(|ratio| ratio * vector.total_length)
        .collect::<Vec<_>>();

    let merge_at = |directions: &mut Vec<u8>, lengths: &mut Vec<f64>, index: usize, into_previous: bool| {
        if into_previous {
            if index == 0 || index >= directions.len() {
                return;
            }
            lengths[index - 1] += lengths[index];
            directions.remove(index);
            lengths.remove(index);
            return;
        }
        if index >= directions.len().saturating_sub(1) {
            return;
        }
        lengths[index] += lengths[index + 1];
        directions.remove(index + 1);
        lengths.remove(index + 1);
    };

    let mut changed = true;
    while changed && !directions.is_empty() {
        changed = false;
        for index in (0..directions.len()).rev() {
            let ratio = lengths[index] / vector.total_length;
            if ratio >= MIN_SEGMENT_LENGTH_RATIO {
                continue;
            }
            let current = directions[index];
            let prev = index.checked_sub(1).map(|value| directions[value]);
            let next = directions.get(index + 1).copied();
            if prev.is_some_and(|value| directions_compatible(value, current)) {
                merge_at(&mut directions, &mut lengths, index, true);
                changed = true;
                break;
            }
            if next.is_some_and(|value| directions_compatible(current, value)) {
                merge_at(&mut directions, &mut lengths, index, false);
                changed = true;
                break;
            }
            if directions.len() > 1 {
                let prev_len = index.checked_sub(1).map(|value| lengths[value]).unwrap_or(0.0);
                let next_len = lengths.get(index + 1).copied().unwrap_or(0.0);
                merge_at(
                    &mut directions,
                    &mut lengths,
                    index,
                    prev_len >= next_len,
                );
                changed = true;
                break;
            }
        }
    }

    for index in (1..directions.len()).rev() {
        if directions[index] == directions[index - 1] {
            merge_at(&mut directions, &mut lengths, index, true);
        }
    }

    let total_length: f64 = lengths.iter().sum();
    if total_length <= f64::EPSILON {
        return GestureVector::empty();
    }

    GestureVector {
        directions,
        segment_lengths: lengths
            .iter()
            .map(|value| value / total_length)
            .collect(),
        total_length,
    }
}

pub fn vector_to_stroke_points(vector: &GestureVector, anchor: &GesturePoint) -> Vec<GesturePoint> {
    if vector.directions.is_empty() || vector.segment_lengths.is_empty() {
        return vec![anchor.clone()];
    }

    let mut x = anchor.x;
    let mut y = anchor.y;
    let mut points = vec![GesturePoint { x, y }];

    for index in 0..vector.directions.len() {
        let direction = vector.directions[index];
        let ratio = vector.segment_lengths[index];
        let (unit_x, unit_y) = direction_unit_vector(direction);
        let length = ratio * vector.total_length;
        x += unit_x * length;
        y += unit_y * length;
        points.push(GesturePoint { x, y });
    }

    points
}

pub fn vector_to_preview_points(vector: &GestureVector, size: f64) -> Vec<GesturePoint> {
    if vector.directions.is_empty() || vector.segment_lengths.is_empty() {
        return Vec::new();
    }
    let origin = size / 2.0;
    let draw_length = size * 0.76;
    let mut x = origin;
    let mut y = origin;
    let mut points = vec![GesturePoint { x, y }];
    for index in 0..vector.directions.len() {
        let direction = vector.directions[index];
        let ratio = vector.segment_lengths[index];
        let (unit_x, unit_y) = direction_unit_vector(direction);
        let length = ratio * draw_length;
        x += unit_x * length;
        y += unit_y * length;
        points.push(GesturePoint { x, y });
    }
    points
}

pub fn gesture_display_points(raw: &[GesturePoint]) -> Vec<GesturePoint> {
    if raw.len() < 2 {
        return raw.to_vec();
    }
    let vector = extract_gesture_vector(raw);
    if vector.directions.is_empty() {
        return raw.to_vec();
    }
    vector_to_stroke_points(&vector, &raw[0])
}

pub fn screen_points_to_gesture_space(screen: &[GesturePoint]) -> Vec<GesturePoint> {
    if screen.is_empty() {
        return Vec::new();
    }
    let origin = &screen[0];
    screen
        .iter()
        .map(|point| GesturePoint {
            x: point.x - origin.x,
            y: origin.y - (point.y - origin.y),
        })
        .collect()
}

pub fn gesture_space_to_screen(gesture: &[GesturePoint], origin: &GesturePoint) -> Vec<GesturePoint> {
    gesture
        .iter()
        .map(|point| GesturePoint {
            x: origin.x + point.x,
            y: origin.y - point.y,
        })
        .collect()
}

pub fn resolve_entry_vector(entry: &GestureMappingEntry) -> GestureVector {
    if !entry.template_directions.is_empty()
        && entry.template_directions.len() == entry.template_segment_lengths.len()
    {
        return GestureVector {
            directions: entry.template_directions.clone(),
            segment_lengths: entry.template_segment_lengths.clone(),
            total_length: entry.template_path_length,
        };
    }
    if entry.template.len() >= 2 {
        return extract_gesture_vector(&entry.template);
    }
    GestureVector::empty()
}

struct TemplateAlignment {
    template_index: usize,
    candidate_ratio: f64,
    direction_quality: f64,
}

fn direction_match_quality(candidate_direction: u8, template_direction: u8) -> f64 {
    if candidate_direction == template_direction {
        return 1.0;
    }
    if directions_compatible(candidate_direction, template_direction) {
        ADJACENT_DIRECTION_MATCH_SCORE
    } else {
        0.0
    }
}

fn is_short_segment(vector: &GestureVector, index: usize, scale: f64) -> bool {
    vector.segment_lengths[index] < MIN_SEGMENT_LENGTH_RATIO * scale
}

fn skip_before_leg_anchor(
    candidate: &GestureVector,
    candidate_index: usize,
    template_direction: u8,
    allow_cardinal_bridge: bool,
) -> bool {
    let candidate_direction = candidate.directions[candidate_index];
    if allow_cardinal_bridge && is_cardinal_direction(candidate_direction) {
        return true;
    }
    if directions_compatible(candidate_direction, template_direction) {
        return true;
    }
    is_short_segment(candidate, candidate_index, 1.5)
}

fn skip_between_legs(
    candidate: &GestureVector,
    candidate_index: usize,
    template_direction: u8,
    next_template_direction: u8,
) -> bool {
    let candidate_direction = candidate.directions[candidate_index];
    if is_cardinal_direction(candidate_direction) {
        return true;
    }
    if directions_compatible(candidate_direction, template_direction) {
        return true;
    }
    if directions_compatible(candidate_direction, next_template_direction) {
        return true;
    }
    is_short_segment(candidate, candidate_index, 1.5)
}

fn count_significant_diagonal_legs(vector: &GestureVector) -> usize {
    vector
        .directions
        .iter()
        .enumerate()
        .filter(|&(index, &direction)| {
            !is_cardinal_direction(direction) && !is_short_segment(vector, index, 1.0)
        })
        .count()
}

fn has_significant_extra_legs(candidate: &GestureVector, start_index: usize) -> bool {
    (start_index..candidate.directions.len()).any(|index| !is_short_segment(candidate, index, 1.0))
}

fn align_candidate_to_template(
    candidate: &GestureVector,
    template: &GestureVector,
) -> Option<Vec<TemplateAlignment>> {
    let mut candidate_index = 0usize;
    let mut pending_bridge_ratio = 0.0;
    let mut alignments = Vec::new();

    for template_index in 0..template.directions.len() {
        let template_direction = template.directions[template_index];
        let next_template_direction = template.directions.get(template_index + 1).copied();
        let allow_corner_bridge = next_template_direction.is_some();

        while candidate_index < candidate.directions.len() {
            let candidate_direction = candidate.directions[candidate_index];
            if directions_compatible(candidate_direction, template_direction) {
                break;
            }
            if skip_before_leg_anchor(
                candidate,
                candidate_index,
                template_direction,
                allow_corner_bridge,
            ) {
                pending_bridge_ratio += candidate.segment_lengths[candidate_index];
                candidate_index += 1;
                continue;
            }
            return None;
        }

        if candidate_index >= candidate.directions.len()
            || !directions_compatible(
                candidate.directions[candidate_index],
                template_direction,
            )
        {
            return None;
        }

        let direction_quality =
            direction_match_quality(candidate.directions[candidate_index], template_direction);
        let mut candidate_ratio = pending_bridge_ratio;
        pending_bridge_ratio = 0.0;
        candidate_ratio += candidate.segment_lengths[candidate_index];
        candidate_index += 1;

        while candidate_index < candidate.directions.len() {
            let candidate_direction = candidate.directions[candidate_index];
            if next_template_direction
                .is_some_and(|value| directions_compatible(candidate_direction, value))
            {
                break;
            }
            if directions_compatible(candidate_direction, template_direction) {
                candidate_ratio += candidate.segment_lengths[candidate_index];
                candidate_index += 1;
                continue;
            }
            if allow_corner_bridge
                && next_template_direction.is_some_and(|next| {
                    skip_between_legs(
                        candidate,
                        candidate_index,
                        template_direction,
                        next,
                    )
                })
            {
                candidate_ratio += candidate.segment_lengths[candidate_index];
                candidate_index += 1;
                continue;
            }
            break;
        }

        alignments.push(TemplateAlignment {
            template_index,
            candidate_ratio,
            direction_quality,
        });
    }

    if alignments.len() != template.directions.len() {
        return None;
    }
    if has_significant_extra_legs(candidate, candidate_index) {
        return None;
    }
    Some(alignments)
}

fn segment_ratio_delta(candidate_ratio: f64, template_ratio: f64) -> f64 {
    ((candidate_ratio + 1e-6) / (template_ratio + 1e-6)).ln().abs()
}

fn template_direction_score(alignments: &[TemplateAlignment]) -> f64 {
    if alignments.is_empty() {
        return 0.0;
    }
    alignments
        .iter()
        .map(|alignment| alignment.direction_quality)
        .sum::<f64>()
        / alignments.len() as f64
}

fn template_length_score(
    alignments: &[TemplateAlignment],
    template: &GestureVector,
) -> f64 {
    if alignments.is_empty() {
        return 0.0;
    }

    let mut total = 0.0;
    for alignment in alignments {
        let template_ratio = template.segment_lengths[alignment.template_index];
        let ratio_delta = segment_ratio_delta(alignment.candidate_ratio, template_ratio);
        total += (1.0 - ratio_delta / LENGTH_RATIO_TOLERANCE).max(0.0);
    }
    total / alignments.len() as f64
}

pub fn prepare_gesture_vector_for_match(vector: &GestureVector) -> GestureVector {
    normalize_gesture_vector(vector)
}

pub fn passes_vector_checks(candidate: &GestureVector, template: &GestureVector) -> bool {
    if template.total_length <= f64::EPSILON || candidate.directions.is_empty() {
        return false;
    }
    candidate.total_length >= template.total_length * MIN_PATH_LENGTH_RATIO
}

pub fn match_vector(candidate: &GestureVector, template: &GestureVector) -> f64 {
    if candidate.directions.is_empty() || template.directions.is_empty() {
        return 0.0;
    }
    if !passes_vector_checks(candidate, template) {
        return 0.0;
    }
    let prepared = prepare_gesture_vector_for_match(candidate);
    if count_significant_diagonal_legs(&prepared) > template.directions.len() {
        return 0.0;
    }
    let Some(alignments) = align_candidate_to_template(&prepared, template) else {
        return 0.0;
    };
    let direction_score = template_direction_score(&alignments);
    let length_score = template_length_score(&alignments, template);
    direction_score * DIRECTION_SCORE_WEIGHT + length_score * LENGTH_SCORE_WEIGHT
}

pub fn raw_path_length(points: &[GesturePoint]) -> f64 {
    path_length(points)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_diagonal_drift_for_cardinal_template() {
        let template = extract_gesture_vector(&[
            GesturePoint { x: 0.0, y: 0.0 },
            GesturePoint { x: 100.0, y: 0.0 },
        ]);
        let candidate = extract_gesture_vector(&[
            GesturePoint { x: 0.0, y: 0.0 },
            GesturePoint { x: 100.0, y: -20.0 },
        ]);
        assert!(passes_vector_checks(&candidate, &template));
        assert!(match_vector(&candidate, &template) >= 0.62);
    }

    fn line(start: GesturePoint, end: GesturePoint, steps: usize) -> Vec<GesturePoint> {
        (0..=steps)
            .map(|index| {
                let t = index as f64 / steps as f64;
                GesturePoint {
                    x: start.x + (end.x - start.x) * t,
                    y: start.y + (end.y - start.y) * t,
                }
            })
            .collect()
    }

    #[test]
    fn matches_v_shape_with_cardinal_corner() {
        let mut template = line(
            GesturePoint { x: 0.0, y: 0.0 },
            GesturePoint { x: 70.0, y: 70.0 },
            12,
        );
        template.extend(
            line(
                GesturePoint { x: 70.0, y: 70.0 },
                GesturePoint { x: 140.0, y: 0.0 },
                12,
            )
            .into_iter()
            .skip(1),
        );
        let template = extract_gesture_vector(&template);
        assert_eq!(template.directions, vec![7, 1]);

        let mut candidate = line(
            GesturePoint { x: 0.0, y: 0.0 },
            GesturePoint { x: 50.0, y: 50.0 },
            10,
        );
        candidate.extend(
            line(
                GesturePoint { x: 50.0, y: 50.0 },
                GesturePoint { x: 50.0, y: 62.0 },
                4,
            )
            .into_iter()
            .skip(1),
        );
        candidate.extend(
            line(
                GesturePoint { x: 50.0, y: 62.0 },
                GesturePoint { x: 62.0, y: 62.0 },
                4,
            )
            .into_iter()
            .skip(1),
        );
        candidate.extend(
            line(
                GesturePoint { x: 62.0, y: 62.0 },
                GesturePoint { x: 130.0, y: 8.0 },
                10,
            )
            .into_iter()
            .skip(1),
        );
        let candidate = extract_gesture_vector(&candidate);
        assert!(passes_vector_checks(&candidate, &template));
        assert!(match_vector(&candidate, &template) >= 0.62);
    }

    #[test]
    fn matches_explicit_cardinal_steps_between_v_diagonals() {
        let template = GestureVector {
            directions: vec![7, 1],
            segment_lengths: vec![0.5, 0.5],
            total_length: 100.0,
        };
        let candidate = GestureVector {
            directions: vec![7, 6, 0, 1],
            segment_lengths: vec![0.42, 0.04, 0.04, 0.5],
            total_length: 100.0,
        };
        assert!(match_vector(&candidate, &template) >= 0.62);
    }

    #[test]
    fn rejects_lowercase_y_against_v() {
        let template = GestureVector {
            directions: vec![7, 1],
            segment_lengths: vec![0.5, 0.5],
            total_length: 100.0,
        };
        let candidate = GestureVector {
            directions: vec![5, 1, 7],
            segment_lengths: vec![0.33, 0.34, 0.33],
            total_length: 100.0,
        };
        assert_eq!(match_vector(&candidate, &template), 0.0);
    }

    #[test]
    fn rejects_uppercase_y_against_v() {
        let template = GestureVector {
            directions: vec![7, 1],
            segment_lengths: vec![0.5, 0.5],
            total_length: 100.0,
        };
        let candidate = GestureVector {
            directions: vec![7, 1, 5],
            segment_lengths: vec![0.33, 0.34, 0.33],
            total_length: 100.0,
        };
        assert_eq!(match_vector(&candidate, &template), 0.0);
    }
}

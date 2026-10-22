-- DISPOSABLE LOCAL DEMO DATA ONLY. Never import into production.
-- Passwords: DemoUser2026! and AdminDemo2026! (bcrypt hashes, cost 10).
-- Run only after schema.sql on a fresh local database. INSERT IGNORE keeps
-- reruns from replacing existing accounts or duplicating the fixed demo rows.
INSERT IGNORE INTO users (username, email, password_hash, role) VALUES
('demo', 'demo@example.test', '$2b$10$QWCCiXLgbwLnZBGhdGOmLOLVt/93D2NogSP0pod7ZEuRyFhk4RKMu', 'user'),
('admin', 'admin@example.test', '$2b$10$eQU02/EySMYJctuy4RAIMOCR2QZ5QqTycl8SUkOn8KqptmejtFfhK', 'admin');

-- Resolve the sample user by both unique identity fields. If either field
-- conflicts with a different local account, this remains NULL and no sample
-- workouts will be attached to that account.
SET @demo_user_id := (
    SELECT id
    FROM users
    WHERE username = 'demo' AND email = 'demo@example.test'
    LIMIT 1
);

INSERT IGNORE INTO workout_type (id, name) VALUES
(1, 'Running'),
(2, 'Strength Training');

INSERT IGNORE INTO exercises (id, exercise_name, muscle_group, equipment, description) VALUES
(1, 'Barbell Squat', 'Legs', 'Barbell', 'Compound lower body exercise.'),
(2, 'Push-Up', 'Chest', 'Bodyweight', 'Bodyweight upper body exercise.'),
(3, 'Dumbbell Row', 'Back', 'Dumbbells', 'Upper body pulling exercise.'),
(4, 'Plank', 'Core', 'Bodyweight', 'Static core stability exercise.');

INSERT IGNORE INTO products (id, name, description, price, image_url, category, stock_quantity, is_active) VALUES
(1, 'Training Water Bottle', 'Reusable demo bottle.', 12.00, NULL, 'Accessories', 25, 1),
(2, 'Resistance Band Set', 'Demo set with several resistance levels.', 24.50, NULL, 'Training', 15, 1),
(3, 'Yoga Mat', 'Demo non-slip exercise mat.', 35.00, NULL, 'Training', 10, 1);

INSERT IGNORE INTO workout (id, user_id, workout_type_id, workout_date, duration_minutes, notes)
SELECT 1, @demo_user_id, 1, '2026-01-15', 32, 'Disposable sample run.'
WHERE @demo_user_id IS NOT NULL;

INSERT IGNORE INTO workout (id, user_id, workout_type_id, workout_date, duration_minutes, notes)
SELECT 2, @demo_user_id, 2, '2026-01-16', 40, 'Disposable sample strength session.'
WHERE @demo_user_id IS NOT NULL;

INSERT IGNORE INTO workout_running
    (workout_id, distance_km, avg_pace_seconds_per_km, running_duration_seconds, avg_heart_rate, elevation_gain_m)
SELECT w.id, 5.000, 384, 1920, 145, 42
FROM workout w
WHERE w.id = 1
  AND w.user_id = @demo_user_id
  AND w.workout_type_id = 1
  AND w.workout_date = '2026-01-15';

INSERT IGNORE INTO strength_exercises (id, workout_id, exercise_id, exercise_order, notes)
SELECT 1, w.id, 1, 1, NULL
FROM workout w
JOIN exercises e ON e.id = 1 AND e.exercise_name = 'Barbell Squat'
WHERE w.id = 2
  AND w.user_id = @demo_user_id
  AND w.workout_type_id = 2
  AND w.workout_date = '2026-01-16';

INSERT IGNORE INTO strength_exercises (id, workout_id, exercise_id, exercise_order, notes)
SELECT 2, w.id, 2, 2, NULL
FROM workout w
JOIN exercises e ON e.id = 2 AND e.exercise_name = 'Push-Up'
WHERE w.id = 2
  AND w.user_id = @demo_user_id
  AND w.workout_type_id = 2
  AND w.workout_date = '2026-01-16';

INSERT IGNORE INTO strength_sets (id, strength_exercise_id, set_number, reps, weight_kg, duration_minutes)
SELECT 1, se.id, 1, 10, 40.00, NULL
FROM strength_exercises se
JOIN workout w ON w.id = se.workout_id
WHERE se.id = 1
  AND se.exercise_id = 1
  AND w.id = 2
  AND w.user_id = @demo_user_id
  AND w.workout_type_id = 2
  AND w.workout_date = '2026-01-16';

INSERT IGNORE INTO strength_sets (id, strength_exercise_id, set_number, reps, weight_kg, duration_minutes)
SELECT 2, se.id, 2, 8, 45.00, NULL
FROM strength_exercises se
JOIN workout w ON w.id = se.workout_id
WHERE se.id = 1
  AND se.exercise_id = 1
  AND w.id = 2
  AND w.user_id = @demo_user_id
  AND w.workout_type_id = 2
  AND w.workout_date = '2026-01-16';

INSERT IGNORE INTO strength_sets (id, strength_exercise_id, set_number, reps, weight_kg, duration_minutes)
SELECT 3, se.id, 1, 12, NULL, NULL
FROM strength_exercises se
JOIN workout w ON w.id = se.workout_id
WHERE se.id = 2
  AND se.exercise_id = 2
  AND w.id = 2
  AND w.user_id = @demo_user_id
  AND w.workout_type_id = 2
  AND w.workout_date = '2026-01-16';

INSERT IGNORE INTO strength_sets (id, strength_exercise_id, set_number, reps, weight_kg, duration_minutes)
SELECT 4, se.id, 2, 10, NULL, NULL
FROM strength_exercises se
JOIN workout w ON w.id = se.workout_id
WHERE se.id = 2
  AND se.exercise_id = 2
  AND w.id = 2
  AND w.user_id = @demo_user_id
  AND w.workout_type_id = 2
  AND w.workout_date = '2026-01-16';

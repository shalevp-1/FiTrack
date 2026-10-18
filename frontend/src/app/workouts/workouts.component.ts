
import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild
} from '@angular/core';

import {
  WorkoutDetails,
  Exercise,
  CreateWorkout,
  StrengthExerciseInput,
  WorkoutService
} from '../services/workout.service';

import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

type HistoryFilter = 'all' | 'running' | 'strength';

interface CalendarDay {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
  workouts: WorkoutDetails[];
}

interface WorkoutMonthGroup {
  key: string;
  label: string;
  workouts: WorkoutDetails[];
}

@Component({
  selector: 'app-workouts',
  templateUrl: './workouts.component.html',
  styleUrls: ['./workouts.component.css']
})
export class WorkoutsComponent implements OnInit, OnDestroy {
  workouts: WorkoutDetails[] = [];
  exercises: Exercise[] = [];

  isLoading = false;
  isLoadingExercises = false;
  isSaving = false;
  showForm = false;
  isEditing = false;
  editingWorkoutId: number | null = null;

  expandedWorkoutIds: number[] = [];

  errorMessage = '';
  successMessage = '';

  readonly Math = Math;

  historyFilter: HistoryFilter = 'all';
  historyView: 'list' | 'calendar' = 'list';

  currentMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );

  selectedCalendarDate: string | null = null;

  // Pagination: display six workouts at a time.
  visibleWorkoutCount = 6;
  readonly workoutPageSize = 6;

  private loadMoreObserver: IntersectionObserver | null = null;
  private loadMoreSentinelElement: HTMLElement | null = null;

  @ViewChild('loadMoreSentinel')
  set loadMoreSentinel(ref: ElementRef<HTMLElement> | undefined) {
    this.loadMoreObserver?.disconnect();
    this.loadMoreObserver = null;

    this.loadMoreSentinelElement = ref?.nativeElement ?? null;

    if (
      !this.loadMoreSentinelElement ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    this.loadMoreObserver = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          this.loadMoreWorkouts();
        }
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0
      }
    );

    this.loadMoreObserver.observe(this.loadMoreSentinelElement);
  }

  newWorkout = {
    workout_type_id: 1,
    workout_date: '',
    duration_minutes: 30,
    notes: ''
  };

  runningDetails = {
    distance_km: 0,
    avg_pace_seconds_per_km: null as number | null,
    running_duration_seconds: null as number | null,
    avg_heart_rate: null as number | null,
    elevation_gain_m: null as number | null
  };

  avgPaceInput = '';

  // Estimated running time in minutes, including fractional minutes.
  // This estimate never overwrites the actual duration.
  estimatedDurationMinutes: number | null = null;

  strengthExercises: StrengthExerciseInput[] = [];
  exerciseSearchTerms: string[] = [];
  exerciseMuscleFilters: string[] = [];
  exerciseDropdownOpen: boolean[] = [];

  maxWorkoutDate = this.getCurrentDateTime();

  constructor(private workoutService: WorkoutService) {}

  ngOnInit(): void {
    this.loadWorkouts();
    this.loadExercises();
  }

  ngOnDestroy(): void {
    this.loadMoreObserver?.disconnect();
  }

  // Workouts currently displayed in the history list.
  get visibleWorkouts(): WorkoutDetails[] {
    return this.filteredWorkouts.slice(0, this.visibleWorkoutCount);
  }

  get visibleWorkoutGroups(): WorkoutMonthGroup[] {
    const groups = new Map<string, WorkoutMonthGroup>();

    this.visibleWorkouts.forEach(workout => {
      const dateKey = this.getDateKey(workout.workout_date);
      const key = dateKey ? dateKey.slice(0, 7) : 'unknown';
      const [year, month] = key.split('-').map(Number);
      let group = groups.get(key);

      if (!group) {
        group = {
          key,
          label: key !== 'unknown'
            ? `${year} - ${new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long' })}`
            : 'Date unavailable',
          workouts: []
        };
        groups.set(key, group);
      }

      group.workouts.push(workout);
    });

    return Array.from(groups.values());
  }

  trackWorkoutGroup(_index: number, group: WorkoutMonthGroup): string {
    return group.key;
  }

  trackWorkoutById(_index: number, workout: WorkoutDetails): number {
    return workout.id;
  }

  trackCalendarDay(_index: number, day: CalendarDay): string {
    return day.key;
  }

  // Reveal the next six workouts when the user scrolls to the bottom.
  loadMoreWorkouts(): void {
    if (
      this.isLoading ||
      this.historyView !== 'list' ||
      this.visibleWorkoutCount >= this.filteredWorkouts.length
    ) {
      return;
    }

    this.visibleWorkoutCount = Math.min(
      this.visibleWorkoutCount + this.workoutPageSize,
      this.filteredWorkouts.length
    );
  }

  // Start again with the newest six workouts.
  private resetVisibleWorkoutCount(): void {
    this.visibleWorkoutCount = this.workoutPageSize;
  }

  private getCurrentDateTime(): string {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  toggleWorkout(workoutId: number): void {
    if (this.expandedWorkoutIds.includes(workoutId)) {
      this.expandedWorkoutIds =
        this.expandedWorkoutIds.filter(id => id !== workoutId);
    } else {
      this.expandedWorkoutIds = [
        ...this.expandedWorkoutIds,
        workoutId
      ];
    }
  }

  isWorkoutExpanded(workoutId: number): boolean {
    return this.expandedWorkoutIds.includes(workoutId);
  }

  get allWorkoutsExpanded(): boolean {
    const visibleIds = this.visibleWorkouts.map(workout => workout.id);

    return visibleIds.length > 0 &&
      visibleIds.every(id => this.expandedWorkoutIds.includes(id));
  }

  toggleAllWorkouts(): void {
    const visibleIds = this.visibleWorkouts.map(workout => workout.id);

    if (visibleIds.length === 0) {
      return;
    }

    if (this.allWorkoutsExpanded) {
      this.expandedWorkoutIds =
        this.expandedWorkoutIds.filter(id => !visibleIds.includes(id));
    } else {
      this.expandedWorkoutIds = [
        ...new Set([
          ...this.expandedWorkoutIds,
          ...visibleIds
        ])
      ];
    }
  }

  loadWorkouts(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.resetVisibleWorkoutCount();

    this.workoutService.getWorkouts().subscribe({
      next: workouts => {
        if (workouts.length === 0) {
          this.workouts = [];
          this.expandedWorkoutIds = [];
          this.isLoading = false;
          return;
        }

        forkJoin(
          workouts.map(workout =>
            this.workoutService.getWorkoutById(workout.id).pipe(
              catchError(error => {
                console.error(
                  `Could not load details for workout ${workout.id}`,
                  error
                );

                return of(workout as WorkoutDetails);
              })
            )
          )
        ).subscribe({
          next: details => {
            // Newest workouts appear first.
            this.workouts = details.sort(
              (a, b) =>
                new Date(b.workout_date).getTime() -
                new Date(a.workout_date).getTime()
            );

            const existingIds = new Set(
              this.workouts.map(workout => workout.id)
            );

            this.expandedWorkoutIds =
              this.expandedWorkoutIds.filter(
                id => existingIds.has(id)
              );

            this.isLoading = false;
          },
          error: error => {
            console.error(
              'Could not load workout details:',
              error
            );

            this.errorMessage =
              'Could not load workout details.';

            this.isLoading = false;
          }
        });
      },
      error: error => {
        console.error('Could not load workouts:', error);

        this.errorMessage =
          error.status === 401
            ? 'Please log in to view your workouts.'
            : 'Could not load workouts.';

        this.isLoading = false;
      }
    });
  }

  loadExercises(): void {
    this.isLoadingExercises = true;

    this.workoutService.getExercises().subscribe({
      next: exercises => {
        this.exercises = exercises;
        this.isLoadingExercises = false;
      },
      error: error => {
        console.error('Could not load exercises:', error);
        this.isLoadingExercises = false;
      }
    });
  }

  get filteredWorkouts(): WorkoutDetails[] {
    let result = this.workouts;

    if (this.historyFilter === 'running') {
      result = result.filter(
        workout => workout.workout_type === 'Running'
      );
    } else if (this.historyFilter === 'strength') {
      result = result.filter(
        workout => workout.workout_type === 'Strength Training'
      );
    }

    if (
      this.historyView === 'calendar' &&
      this.selectedCalendarDate
    ) {
      result = result.filter(
        workout =>
          this.getDateKey(workout.workout_date) ===
          this.selectedCalendarDate
      );
    }

    return result;
  }

  get calendarDays(): CalendarDay[] {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7;

    const start = new Date(year, month, 1 - offset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);

      date.setDate(start.getDate() + index);

      const key = this.dateKeyFromDate(date);

      return {
        date,
        key,
        inCurrentMonth: date.getMonth() === month,
        workouts: this.workouts.filter(
          workout =>
            this.getDateKey(workout.workout_date) === key
        )
      };
    });
  }

  get filteredWorkoutCount(): number {
    return this.filteredWorkouts.length;
  }

  setHistoryFilter(filter: HistoryFilter): void {
    this.historyFilter = filter;
    this.resetVisibleWorkoutCount();
  }

  setHistoryView(view: 'list' | 'calendar'): void {
    this.historyView = view;

    if (view === 'list') {
      this.selectedCalendarDate = null;
    }

    this.resetVisibleWorkoutCount();
  }

  previousMonth(): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() - 1,
      1
    );
  }

  nextMonth(): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() + 1,
      1
    );
  }

  goToCurrentMonth(): void {
    const now = new Date();

    this.currentMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );
  }

  selectCalendarDate(key: string): void {
    this.selectedCalendarDate =
      this.selectedCalendarDate === key ? null : key;
  }

  private dateKeyFromDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private parseWorkoutDate(value: string): Date | null {
    const dateKey = this.getDateKey(value);
    if (dateKey) {
      const [year, month, day] = dateKey.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    const date = new Date(value.replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  getDateKey(value: string | Date): string {
    if (typeof value === 'string') {
      const match = value.match(/^(\d{4}-\d{2}-\d{2})/);

      if (match) {
        return match[1];
      }
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? ''
      : this.dateKeyFromDate(date);
  }

  get monthLabel(): string {
    return this.currentMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }

  onWorkoutTypeChange(): void {
    this.resetRunningDetails();

    if (this.newWorkout.workout_type_id === 1) {
      this.strengthExercises = [];
      this.resetExercisePickerState();
    } else if (this.strengthExercises.length === 0) {
      this.addExercise();
    }
  }

  private resetRunningDetails(): void {
    this.runningDetails = {
      distance_km: 0,
      avg_pace_seconds_per_km: null,
      running_duration_seconds: null,
      avg_heart_rate: null,
      elevation_gain_m: null
    };

    this.avgPaceInput = '';
    this.estimatedDurationMinutes = null;
  }

  // Recalculate estimated running time whenever distance or pace changes.
  updateEstimatedDuration(): void {
    if (this.newWorkout.workout_type_id !== 1) {
      this.estimatedDurationMinutes = null;
      return;
    }

    const distance = Number(this.runningDetails.distance_km);
    const paceSeconds = this.parsePaceInput();

    if (
      !Number.isFinite(distance) ||
      distance <= 0 ||
      paceSeconds === null ||
      !Number.isFinite(paceSeconds) ||
      paceSeconds <= 0
    ) {
      this.estimatedDurationMinutes = null;
      return;
    }

    // Distance in km × pace in seconds per km = estimated total seconds.
    this.estimatedDurationMinutes =
      (distance * paceSeconds) / 60;
  }

  // Format running time as hours, minutes, and any remaining seconds.
  formatEstimatedDuration(minutes: number): string {
    if (!Number.isFinite(minutes) || minutes < 0) {
      return '—';
    }

    const totalSeconds = Math.round(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const wholeMinutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours} hr`);
    }
    if (wholeMinutes > 0) {
      parts.push(`${wholeMinutes} min`);
    }
    if (remainingSeconds > 0 || parts.length === 0) {
      parts.push(`${remainingSeconds} sec`);
    }

    return parts.join(' ');
  }

  private parsePaceInput(): number | null {
    const value = this.avgPaceInput.trim();

    if (!value) {
      return null;
    }

    const match = value.match(/^(\d{1,3}):([0-5]\d)$/);

    if (!match) {
      return NaN;
    }

    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const totalSeconds = minutes * 60 + seconds;

    if (totalSeconds < 1 || totalSeconds > 999 * 60 + 59) {
      return NaN;
    }

    return totalSeconds;
  }

  private formatPace(
    seconds: number | null | undefined
  ): string {
    if (seconds == null || !Number.isFinite(Number(seconds))) {
      return '';
    }

    const totalSeconds = Number(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainder = Math.floor(totalSeconds % 60);

    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  }

  addExercise(): void {
    this.strengthExercises.push({
      exercise_id: 0,
      notes: '',
      sets: [
        {
          reps: 10,
          weight_kg: null,
          duration_minutes: null
        }
      ]
    });

    this.exerciseSearchTerms.push('');
    this.exerciseMuscleFilters.push('');
    this.exerciseDropdownOpen.push(false);
  }

  removeExercise(index: number): void {
    this.strengthExercises.splice(index, 1);
    this.exerciseSearchTerms.splice(index, 1);
    this.exerciseMuscleFilters.splice(index, 1);
    this.exerciseDropdownOpen.splice(index, 1);
  }

  private resetExercisePickerState(): void {
    this.exerciseSearchTerms = [];
    this.exerciseMuscleFilters = [];
    this.exerciseDropdownOpen = [];
  }

  getMuscleGroups(): string[] {
    return [...new Set(
      this.exercises
        .map(exercise => exercise.muscle_group?.trim())
        .filter((group): group is string => !!group)
    )].sort();
  }

  filteredExercises(index: number): Exercise[] {
    const search =
      (this.exerciseSearchTerms[index] || '').toLowerCase().trim();

    const muscle = this.exerciseMuscleFilters[index];

    return this.exercises.filter(exercise => {
      const matchesMuscle =
        !muscle || exercise.muscle_group === muscle;

      const searchableText = [
        exercise.exercise_name,
        exercise.muscle_group,
        exercise.equipment
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesMuscle &&
        (!search || searchableText.includes(search));
    });
  }

  selectExercise(index: number, exercise: Exercise): void {
    this.strengthExercises[index].exercise_id = exercise.id;
    this.exerciseSearchTerms[index] = exercise.exercise_name;
    this.exerciseDropdownOpen[index] = false;
  }

  getExerciseName(exerciseId: number): string {
    return this.exercises.find(
      exercise => exercise.id === exerciseId
    )?.exercise_name || 'Unknown exercise';
  }

  addSet(exerciseIndex: number): void {
    this.strengthExercises[exerciseIndex].sets.push({
      reps: 10,
      weight_kg: null,
      duration_minutes: null
    });
  }

  removeSet(exerciseIndex: number, setIndex: number): void {
    const sets = this.strengthExercises[exerciseIndex].sets;

    if (sets.length > 1) {
      sets.splice(setIndex, 1);
    }
  }

  createWorkout(): void {
    this.saveWorkout();
  }

  saveWorkout(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const fail = (message: string): void => {
      this.errorMessage = message;
    };

    this.maxWorkoutDate = this.getCurrentDateTime();

    if (!this.isValidWorkoutDate(this.newWorkout.workout_date)) {
      fail(
        'Workout date must be between January 1, 1950 and the current date and time.'
      );
      return;
    }

    if (!this.isWholeNumberInRange(
      this.newWorkout.duration_minutes,
      1,
      99999999
    )) {
      fail(
        'Workout duration must be between 1 and 99,999,999 minutes.'
      );
      return;
    }

    const payload: CreateWorkout = {
      workout_type_id: Number(this.newWorkout.workout_type_id),
      workout_date:
        this.newWorkout.workout_date.replace('T', ' ') + ':00',
      duration_minutes: Number(this.newWorkout.duration_minutes),
      notes: this.newWorkout.notes.trim()
    };

    if (payload.workout_type_id === 1) {
      if (!this.isNumberInRange(
        this.runningDetails.distance_km,
        0.01,
        9999
      )) {
        fail(
          'Distance must be greater than 0 and no more than 9,999 km.'
        );
        return;
      }

      const pace = this.parsePaceInput();

      if (pace === null || !Number.isFinite(pace) || pace <= 0) {
        fail(
          'Please enter a valid average pace in mm:ss format.'
        );
        return;
      }

      const heartRate = this.runningDetails.avg_heart_rate;

      if (
        heartRate != null &&
        !this.isWholeNumberInRange(heartRate, 20, 240)
      ) {
        fail(
          'Average heart rate must be between 20 and 240 bpm.'
        );
        return;
      }

      const elevation = this.runningDetails.elevation_gain_m;

      if (
        elevation != null &&
        !this.isWholeNumberInRange(elevation, 0, 9999)
      ) {
        fail(
          'Elevation gain must be between 0 and 9,999 metres.'
        );
        return;
      }

      // The backend calculates running_duration_seconds.
      // Angular sends only the source values: distance and pace.
      payload.running = {
        distance_km: Number(this.runningDetails.distance_km),
        avg_pace_seconds_per_km: pace,
        avg_heart_rate: heartRate,
        elevation_gain_m: elevation
      };
    } else {
      if (this.strengthExercises.length === 0) {
        fail('Add at least one exercise.');
        return;
      }

      for (const exercise of this.strengthExercises) {
        if (!exercise.exercise_id) {
          fail('Choose an exercise for every exercise entry.');
          return;
        }

        if (exercise.sets.length === 0) {
          fail('Each exercise needs at least one set.');
          return;
        }

        for (const set of exercise.sets) {
          if (set.reps == null && set.duration_minutes == null) {
            fail('Each set needs reps or a duration.');
            return;
          }

          if (
            set.reps != null &&
            !this.isWholeNumberInRange(set.reps, 0, 999)
          ) {
            fail(
              'Reps must be a whole number between 0 and 999.'
            );
            return;
          }

          if (
            set.weight_kg != null &&
            !this.isNumberInRange(set.weight_kg, 0, 9999)
          ) {
            fail('Weight must be between 0 and 9,999 kg.');
            return;
          }

          if (
            set.duration_minutes != null &&
            !this.isWholeNumberInRange(
              set.duration_minutes,
              0,
              99999999
            )
          ) {
            fail(
              'Set duration must be between 0 and 99,999,999 minutes.'
            );
            return;
          }
        }
      }

      payload.exercises = this.strengthExercises.map(exercise => ({
        exercise_id: Number(exercise.exercise_id),
        notes: exercise.notes.trim(),
        sets: exercise.sets.map(set => ({
          reps: set.reps == null ? null : Number(set.reps),
          weight_kg:
            set.weight_kg == null ? null : Number(set.weight_kg),
          duration_minutes:
            set.duration_minutes == null
              ? null
              : Number(set.duration_minutes)
        }))
      }));
    }

    this.isSaving = true;

    const request =
      this.isEditing && this.editingWorkoutId !== null
        ? this.workoutService.updateWorkout(
            this.editingWorkoutId,
            payload
          )
        : this.workoutService.createWorkout(payload);

    request.subscribe({
      next: () => {
        this.successMessage = this.isEditing
          ? 'Workout updated successfully.'
          : 'Workout saved successfully.';

        this.isSaving = false;
        this.showForm = false;

        this.resetForm();
        this.loadWorkouts();
      },
      error: error => {
        console.error('Could not save workout:', error);

        this.errorMessage =
          error.error?.message ||
          'Could not save the workout. Please try again.';

        this.isSaving = false;
      }
    });
  }

  editWorkout(workout: WorkoutDetails): void {
    this.errorMessage = '';
    this.successMessage = '';

    this.workoutService.getWorkoutById(workout.id).subscribe({
      next: details => {
        this.isEditing = true;
        this.editingWorkoutId = details.id;
        this.showForm = true;
        this.maxWorkoutDate = this.getCurrentDateTime();

        this.newWorkout = {
          workout_type_id: details.workout_type_id,
          workout_date: this.toDateTimeLocal(details.workout_date),
          duration_minutes: details.duration_minutes,
          notes: details.notes || ''
        };

        this.resetRunningDetails();
        this.strengthExercises = [];
        this.resetExercisePickerState();

        if (
          details.workout_type === 'Running' &&
          details.running
        ) {
          this.runningDetails = {
            distance_km: Number(details.running.distance_km),
            avg_pace_seconds_per_km:
              details.running.avg_pace_seconds_per_km == null
                ? null
                : Number(
                    details.running.avg_pace_seconds_per_km
                  ),
            running_duration_seconds:
              details.running.running_duration_seconds == null
                ? null
                : Number(
                    details.running.running_duration_seconds
                  ),
            avg_heart_rate:
              details.running.avg_heart_rate == null
                ? null
                : Number(details.running.avg_heart_rate),
            elevation_gain_m:
              details.running.elevation_gain_m == null
                ? null
                : Number(details.running.elevation_gain_m)
          };

          this.avgPaceInput = this.formatPace(
            details.running.avg_pace_seconds_per_km
          );

          // Show the estimate for the loaded distance and pace.
          this.updateEstimatedDuration();
        }

        if (details.workout_type === 'Strength Training') {
          this.strengthExercises =
            (details.exercises || []).map(exercise => ({
              exercise_id: exercise.exercise_id,
              notes: exercise.notes || '',
              sets: exercise.sets.map(set => ({
                reps: set.reps == null ? null : Number(set.reps),
                weight_kg:
                  set.weight_kg == null
                    ? null
                    : Number(set.weight_kg),
                duration_minutes:
                  set.duration_minutes == null
                    ? null
                    : Number(set.duration_minutes)
              }))
            }));

          this.strengthExercises.forEach(exercise => {
            this.exerciseSearchTerms.push(
              this.getExerciseName(exercise.exercise_id)
            );

            this.exerciseMuscleFilters.push('');
            this.exerciseDropdownOpen.push(false);
          });

          if (this.strengthExercises.length === 0) {
            this.addExercise();
          }
        }

        this.scrollToForm();
      },
      error: error => {
        console.error(
          'Could not load workout for editing:',
          error
        );

        this.errorMessage =
          'Could not load this workout for editing.';
      }
    });
  }

  deleteWorkout(workout: WorkoutDetails): void {
    const confirmed = window.confirm(
      `Delete this ${workout.workout_type.toLowerCase()} workout? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.workoutService.deleteWorkout(workout.id).subscribe({
      next: () => {
        this.successMessage = 'Workout deleted successfully.';

        if (
          this.selectedCalendarDate &&
          this.getDateKey(workout.workout_date) ===
            this.selectedCalendarDate
        ) {
          this.selectedCalendarDate = null;
        }

        this.expandedWorkoutIds =
          this.expandedWorkoutIds.filter(
            id => id !== workout.id
          );

        this.loadWorkouts();
      },
      error: error => {
        console.error('Could not delete workout:', error);

        this.errorMessage =
          error.error?.message ||
          'Could not delete this workout.';
      }
    });
  }

  private toDateTimeLocal(value: string): string {
    const normalized = value.replace(' ', 'T');

    return normalized.length >= 16
      ? normalized.slice(0, 16)
      : normalized;
  }

  private scrollToForm(): void {
    setTimeout(() => {
      document.querySelector('.workout-form-card')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
    });
  }

  cancelForm(): void {
    this.showForm = false;
    this.resetForm();
    this.errorMessage = '';
  }

  resetForm(): void {
    this.isEditing = false;
    this.editingWorkoutId = null;

    this.newWorkout = {
      workout_type_id: 1,
      workout_date: '',
      duration_minutes: 30,
      notes: ''
    };

    this.resetRunningDetails();
    this.strengthExercises = [];
    this.resetExercisePickerState();

    this.maxWorkoutDate = this.getCurrentDateTime();
  }

  formatDateForDisplay(value: string): string {
    const date = this.parseWorkoutDate(value);
    if (!date) {
      return value;
    }

    const dateText = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeMatch = value.match(/[T ](\d{2}):(\d{2})/);
    return timeMatch
      ? `${dateText}, ${timeMatch[1]}:${timeMatch[2]}`
      : dateText;
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes
      ? `${hours} hr ${remainingMinutes} min`
      : `${hours} hr`;
  }

  private isWholeNumberInRange(
    value: unknown,
    min: number,
    max: number
  ): boolean {
    const numberValue = Number(value);

    return value !== null &&
      value !== '' &&
      Number.isFinite(numberValue) &&
      Number.isInteger(numberValue) &&
      numberValue >= min &&
      numberValue <= max;
  }

  private isNumberInRange(
    value: unknown,
    min: number,
    max: number
  ): boolean {
    const numberValue = Number(value);

    return value !== null &&
      value !== '' &&
      Number.isFinite(numberValue) &&
      numberValue >= min &&
      numberValue <= max;
  }

  validateWorkoutDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (!value) {
      return;
    }

    if (!this.isValidWorkoutDate(value)) {
      input.setCustomValidity(
        'Enter a date and time between January 1, 1950 and now.'
      );

      this.errorMessage =
        'Workout date must be between January 1, 1950 and the current date and time.';

      return;
    }

    input.setCustomValidity('');
    this.errorMessage = '';
  }

  private isValidWorkoutDate(value: string): boolean {
    if (typeof value !== 'string' || !value) {
      return false;
    }

    const match = value.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
    );

    if (!match) {
      return false;
    }

    const [
      ,
      yearText,
      monthText,
      dayText,
      hourText,
      minuteText
    ] = match;

    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (
      year < 1950 ||
      year > 9999 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return false;
    }

    const date = new Date(
      year,
      month - 1,
      day,
      hour,
      minute,
      0,
      0
    );

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day ||
      date.getHours() !== hour ||
      date.getMinutes() !== minute
    ) {
      return false;
    }

    return date.getTime() <= Date.now();
  }

  limitDigits(event: Event, maxDigits: number): void {
    const input = event.target as HTMLInputElement;

    const cleaned = input.value
      .replace(/\D/g, '')
      .slice(0, maxDigits);

    if (input.value !== cleaned) {
      input.value = cleaned;
    }
  }

  limitDecimal(
    event: Event,
    maxWholeDigits: number,
    maxDecimalDigits: number
  ): void {
    const input = event.target as HTMLInputElement;

    let value = input.value.replace(/[^0-9.]/g, '');

    const dotIndex = value.indexOf('.');

    if (dotIndex !== -1) {
      value =
        value.slice(0, dotIndex + 1) +
        value.slice(dotIndex + 1).replace(/\./g, '');
    }

    const parts = value.split('.');

    parts[0] = parts[0].slice(0, maxWholeDigits);

    if (parts.length > 1) {
      parts[1] = parts[1].slice(0, maxDecimalDigits);
      value = parts[0] + '.' + parts[1];
    } else {
      value = parts[0];
    }

    if (input.value !== value) {
      input.value = value;
    }
  }
}

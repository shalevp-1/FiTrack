import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren
} from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { WorkoutDetails, WorkoutService } from '../services/workout.service';

type ActivityPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface ActivityPeriodOption {
  value: ActivityPeriod;
  label: string;
  title: string;
}

interface ActivityBucket {
  label: string;
  minutes: number;
  count: number;
  runningMinutes: number;
  strengthMinutes: number;
  height: number;
}

interface DashboardCalendarDay {
  date: Date;
  inCurrentMonth: boolean;
  workouts: WorkoutDetails[];
}

interface StrengthWeekDay {
  label: string;
  completed: boolean;
}

interface MonthlyChartPoint {
  day: number;
  value: number;
  x: number;
  y: number;
}

interface MonthlyProgressChart {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  baseline: number;
  maxValue: number;
  ticks: number[];
  points: MonthlyChartPoint[];
  linePath: string;
  areaPath: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  workouts: WorkoutDetails[] = [];
  calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  isLoading = false;
  errorMessage = '';
  selectedPeriod: ActivityPeriod = 'weekly';
  readonly periodOptions: ActivityPeriodOption[] = [
    { value: 'weekly', label: 'Week', title: 'This week' },
    { value: 'monthly', label: 'Month', title: 'This month' },
    { value: 'yearly', label: 'Year', title: 'This year' }
  ];

  @ViewChildren('scrollReveal', { read: ElementRef })
  private scrollRevealElements!: QueryList<ElementRef<HTMLElement>>;

  private revealObserver: IntersectionObserver | null = null;
  private revealChangesSubscription: Subscription | null = null;

  constructor(private workoutService: WorkoutService) {}

  ngOnInit(): void {
    this.loadWorkouts();
  }

  ngAfterViewInit(): void {
    this.revealChangesSubscription =
      this.scrollRevealElements.changes.subscribe(() => this.observeRevealElements());
    this.observeRevealElements();
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    this.revealChangesSubscription?.unsubscribe();
  }

  private observeRevealElements(): void {
    this.revealObserver?.disconnect();

    if (typeof IntersectionObserver === 'undefined') {
      this.scrollRevealElements.forEach(item =>
        item.nativeElement.classList.add('reveal-visible')
      );
      return;
    }

    this.revealObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
          } else {
            entry.target.classList.remove('reveal-visible');
          }
        });
      },
      { threshold: 0.12, rootMargin: '250px 0px 0px 0px' }
    );

    this.scrollRevealElements.forEach(item => {
      if (!item.nativeElement.classList.contains('reveal-visible')) {
        this.revealObserver?.observe(item.nativeElement);
      }
    });
  }

  loadWorkouts(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.workoutService.getWorkouts().subscribe({
      next: workouts => {
        if (workouts.length === 0) {
          this.workouts = [];
          this.isLoading = false;
          return;
        }

        forkJoin(
          workouts.map(workout =>
            this.workoutService.getWorkoutById(workout.id).pipe(
              catchError(error => {
                console.error(`Could not load workout ${workout.id}`, error);
                return of(workout as WorkoutDetails);
              })
            )
          )
        ).subscribe({
          next: details => {
            this.workouts = details.sort(
              (a, b) =>
                new Date(b.workout_date).getTime() -
                new Date(a.workout_date).getTime()
            );
            this.isLoading = false;
          },
          error: error => {
            console.error('Could not load workout details:', error);
            this.errorMessage = 'Could not load your workout summary.';
            this.isLoading = false;
          }
        });
      },
      error: error => {
        console.error('Could not load workouts:', error);
        this.errorMessage =
          error.status === 401
            ? 'Please log in to view your dashboard.'
            : 'Could not load your workout summary.';
        this.isLoading = false;
      }
    });
  }

  get totalWorkouts(): number {
    return this.workouts.length;
  }

  get runningWorkouts(): WorkoutDetails[] {
    return this.workouts.filter(workout => workout.workout_type === 'Running');
  }

  get strengthWorkouts(): WorkoutDetails[] {
    return this.workouts.filter(
      workout => workout.workout_type === 'Strength Training'
    );
  }

  get totalMinutes(): number {
    return this.workouts.reduce(
      (total, workout) => total + Number(workout.duration_minutes || 0),
      0
    );
  }

  get totalDistanceKm(): number {
    return this.runningWorkouts.reduce(
      (total, workout) => total + Number(workout.running?.distance_km || 0),
      0
    );
  }

  get longestRun(): WorkoutDetails | null {
    return this.runningWorkouts.reduce<WorkoutDetails | null>(
      (longest, workout) => {
        const distance = Number(workout.running?.distance_km);
        if (!Number.isFinite(distance) || distance <= 0) {
          return longest;
        }

        return !longest ||
          distance > Number(longest.running?.distance_km)
          ? workout
          : longest;
      },
      null
    );
  }

  get totalRunningMinutes(): number {
    return this.runningWorkouts.reduce(
      (total, workout) => total + Number(workout.duration_minutes || 0),
      0
    );
  }

  get totalStrengthMinutes(): number {
    return this.strengthWorkouts.reduce(
      (total, workout) => total + Number(workout.duration_minutes || 0),
      0
    );
  }

  get currentMonthLabel(): string {
    return new Date().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }

  get monthlyRunningChart(): MonthlyProgressChart {
    const values = Array.from({ length: this.currentMonthDays }, () => 0);

    this.workouts.forEach(workout => {
      const date = this.parseDate(workout.workout_date);
      const distance = Number(workout.running?.distance_km || 0);
      if (
        workout.workout_type === 'Running' &&
        date &&
        date.getFullYear() === new Date().getFullYear() &&
        date.getMonth() === new Date().getMonth() &&
        Number.isFinite(distance) &&
        distance > 0
      ) {
        values[date.getDate() - 1] += distance;
      }
    });

    let cumulativeDistance = 0;
    const cumulativeValues = values.map(distance => {
      cumulativeDistance += distance;
      return cumulativeDistance;
    });

    const visibleDays = new Date().getDate();
    return this.createMonthlyChart(
      cumulativeValues.slice(0, visibleDays),
      values.length
    );
  }

  get weeklyStrengthDays(): StrengthWeekDay[] {
    const today = new Date();
    const sunday = this.startOfDay(today);
    sunday.setDate(sunday.getDate() - sunday.getDay());
    const todayKey = this.calendarDateKey(today);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + index);
      const dateKey = this.calendarDateKey(date);
      return {
        label: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        completed: dateKey <= todayKey && this.strengthWorkouts.some(
          workout => this.calendarDateKey(this.parseDate(workout.workout_date)) === dateKey
        )
      };
    });
  }

  get weeklyStrengthSessionCount(): number {
    const today = new Date();
    const sunday = this.startOfDay(today);
    sunday.setDate(sunday.getDate() - sunday.getDay());
    const sundayKey = this.calendarDateKey(sunday);
    const todayKey = this.calendarDateKey(today);

    return this.strengthWorkouts.filter(workout => {
      const date = this.parseDate(workout.workout_date);
      const dateKey = this.calendarDateKey(date);
      return !!date && dateKey >= sundayKey && dateKey <= todayKey;
    }).length;
  }

  private get currentMonthDays(): number {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }

  private createMonthlyChart(
    values: number[],
    axisDays = values.length
  ): MonthlyProgressChart {
    const width = 960;
    const height = 250;
    const plotLeft = 54;
    const plotRight = 944;
    const plotTop = 20;
    const baseline = 205;
    const largestValue = Math.max(...values, 0);
    const rawStep = largestValue > 0 ? largestValue / 4 : 1;
    const stepMagnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalizedStep = rawStep / stepMagnitude;
    const stepFactor = normalizedStep <= 1
      ? 1
      : normalizedStep <= 2
        ? 2
        : normalizedStep <= 2.5
          ? 2.5
          : normalizedStep <= 5
            ? 5
            : 10;
    const tickStep = stepFactor * stepMagnitude;
    const maxValue = Math.max(
      tickStep,
      Math.ceil(largestValue / tickStep) * tickStep
    );
    const plotHeight = baseline - plotTop;
    const ticks = Array.from(
      { length: Math.round(maxValue / tickStep) + 1 },
      (_, index) => index * tickStep
    );
    const points = values.map((value, index) => {
      const x = plotLeft +
        (index / Math.max(axisDays - 1, 1)) * (plotRight - plotLeft);
      return {
        day: index + 1,
        value,
        x,
        y: baseline - (value / maxValue) * plotHeight
      };
    });
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    let linePath = `M ${firstPoint.x} ${firstPoint.y}`;

    for (let index = 1; index < points.length; index += 1) {
      linePath += ` H ${points[index].x} V ${points[index].y}`;
    }

    const areaPath =
      `${linePath} L ${lastPoint.x} ${baseline} ` +
      `L ${firstPoint.x} ${baseline} Z`;

    return {
      width,
      height,
      plotLeft,
      plotRight,
      plotTop,
      baseline,
      maxValue,
      ticks,
      points,
      linePath,
      areaPath
    };
  }

  get totalSets(): number {
    return this.strengthWorkouts.reduce((total, workout) => {
      return total + (workout.exercises || []).reduce(
        (exerciseTotal, exercise) =>
          exerciseTotal + (exercise.sets?.length || 0),
        0
      );
    }, 0);
  }

  get favoriteType(): string {
    if (this.runningWorkouts.length === this.strengthWorkouts.length) {
      return this.totalWorkouts ? 'Balanced' : 'None yet';
    }

    return this.runningWorkouts.length > this.strengthWorkouts.length
      ? 'Running'
      : 'Strength';
  }

  get activityChart(): ActivityBucket[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets: Omit<ActivityBucket, 'height'>[] = [];
    const activityBySlot = new Map<string, {
      minutes: number;
      count: number;
      runningMinutes: number;
      strengthMinutes: number;
    }>();

    if (this.selectedPeriod === 'daily') {
      for (let hour = 0; hour < 24; hour += 1) {
        const date = new Date(today);
        date.setHours(hour);
        buckets.push({
          label: hour % 6 === 0
            ? date.toLocaleTimeString('en-US', { hour: 'numeric' })
              .replace(' AM', 'a')
              .replace(' PM', 'p')
            : '',
          minutes: 0,
          count: 0,
          runningMinutes: 0,
          strengthMinutes: 0
        });
      }
    } else if (this.selectedPeriod === 'weekly') {
      for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - daysAgo);
        buckets.push({
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
          minutes: 0,
          count: 0,
          runningMinutes: 0,
          strengthMinutes: 0
        });
      }
    } else if (this.selectedPeriod === 'monthly') {
      const daysInMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      ).getDate();
      for (let day = 1; day <= daysInMonth; day += 1) {
        buckets.push({
          label: String(day),
          minutes: 0,
          count: 0,
          runningMinutes: 0,
          strengthMinutes: 0
        });
      }
    } else {
      for (let month = 0; month < 12; month += 1) {
        const date = new Date(today.getFullYear(), month, 1);
        buckets.push({
          label: date.toLocaleDateString('en-US', { month: 'short' }),
          minutes: 0,
          count: 0,
          runningMinutes: 0,
          strengthMinutes: 0
        });
      }
    }

    this.periodWorkouts.forEach(workout => {
      const date = this.parseDate(workout.workout_date);
      if (!date) {
        return;
      }

      let key: string;
      if (this.selectedPeriod === 'daily') {
        key = String(date.getHours());
      } else if (this.selectedPeriod === 'yearly') {
        key = String(date.getMonth());
      } else {
        const dayOffset = Math.round(
          (this.calendarDayNumber(date) - this.calendarDayNumber(this.periodStart)) /
            86400000
        );
        key = String(this.selectedPeriod === 'monthly'
          ? date.getDate() - 1
          : dayOffset);
      }

      const duration = Number(workout.duration_minutes || 0);
      const activity = activityBySlot.get(key) || {
        minutes: 0,
        count: 0,
        runningMinutes: 0,
        strengthMinutes: 0
      };
      activity.minutes += duration;
      activity.count += 1;
      if (workout.workout_type === 'Running') {
        activity.runningMinutes += duration;
      } else if (workout.workout_type === 'Strength Training') {
        activity.strengthMinutes += duration;
      }
      activityBySlot.set(key, activity);
    });

    buckets.forEach((bucket, index) => {
      const activity = activityBySlot.get(String(index));
      if (activity) {
        bucket.minutes = activity.minutes;
        bucket.count = activity.count;
        bucket.runningMinutes = activity.runningMinutes;
        bucket.strengthMinutes = activity.strengthMinutes;
      }
    });

    const maxMinutes = Math.max(...buckets.map(day => day.minutes), 0);
    return buckets.map(day => ({
      ...day,
      height: maxMinutes ? Math.max(8, Math.round(day.minutes / maxMinutes * 100)) : 0
    }));
  }

  get periodTitle(): string {
    return this.periodOptions.find(period => period.value === this.selectedPeriod)?.title || 'This week';
  }

  setPeriod(period: ActivityPeriod): void {
    this.selectedPeriod = period;
  }

  get periodStart(): Date {
    const today = this.startOfDay(new Date());
    if (this.selectedPeriod === 'daily') {
      return today;
    }
    if (this.selectedPeriod === 'weekly') {
      today.setDate(today.getDate() - 6);
      return today;
    }
    if (this.selectedPeriod === 'monthly') {
      return new Date(today.getFullYear(), today.getMonth(), 1);
    }
    return new Date(today.getFullYear(), 0, 1);
  }

  get periodWorkouts(): WorkoutDetails[] {
    const start = this.periodStart.getTime();
    const end = this.startOfDay(new Date()).getTime() + 86400000;
    return this.workouts.filter(workout => {
      const date = this.parseDate(workout.workout_date);
      return !!date && date.getTime() >= start && date.getTime() < end;
    });
  }

  get periodTotalWorkouts(): number {
    return this.periodWorkouts.length;
  }

  get periodRunningWorkouts(): WorkoutDetails[] {
    return this.periodWorkouts.filter(workout => workout.workout_type === 'Running');
  }

  get periodStrengthWorkouts(): WorkoutDetails[] {
    return this.periodWorkouts.filter(
      workout => workout.workout_type === 'Strength Training'
    );
  }

  get periodRunningShare(): number {
    return this.periodTotalWorkouts
      ? Math.round(this.periodRunningWorkouts.length / this.periodTotalWorkouts * 100)
      : 0;
  }

  get periodStrengthShare(): number {
    return this.periodTotalWorkouts
      ? Math.round(this.periodStrengthWorkouts.length / this.periodTotalWorkouts * 100)
      : 0;
  }

  get periodTotalMinutes(): number {
    return this.periodWorkouts.reduce(
      (total, workout) => total + Number(workout.duration_minutes || 0),
      0
    );
  }

  get periodDistanceKm(): number {
    return this.periodWorkouts
      .filter(workout => workout.workout_type === 'Running')
      .reduce((total, workout) => total + Number(workout.running?.distance_km || 0), 0);
  }

  get periodRunningMinutes(): number {
    return this.periodRunningWorkouts.reduce(
      (total, workout) => total + Number(workout.duration_minutes || 0),
      0
    );
  }

  get periodStrengthMinutes(): number {
    return this.periodStrengthWorkouts.reduce(
      (total, workout) => total + Number(workout.duration_minutes || 0),
      0
    );
  }

  get periodSets(): number {
    return this.periodWorkouts
      .filter(workout => workout.workout_type === 'Strength Training')
      .reduce((total, workout) => total + (workout.exercises || []).reduce(
        (exerciseTotal, exercise) => exerciseTotal + (exercise.sets?.length || 0),
        0
      ), 0);
  }

  get dashboardCalendarDays(): DashboardCalendarDay[] {
    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - mondayOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const key = this.calendarDateKey(date);

      return {
        date,
        inCurrentMonth: date.getMonth() === month,
        workouts: this.workouts.filter(workout =>
          this.calendarDateKey(this.parseDate(workout.workout_date)) === key
        )
      };
    });
  }

  get dashboardCalendarTitle(): string {
    return this.calendarMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }

  previousCalendarMonth(): void {
    this.calendarMonth = new Date(
      this.calendarMonth.getFullYear(),
      this.calendarMonth.getMonth() - 1,
      1
    );
  }

  nextCalendarMonth(): void {
    this.calendarMonth = new Date(
      this.calendarMonth.getFullYear(),
      this.calendarMonth.getMonth() + 1,
      1
    );
  }

  private calendarDateKey(date: Date | null): string {
    if (!date) {
      return '';
    }

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  get periodAverageMinutes(): number {
    return this.periodTotalWorkouts
      ? Math.round(this.periodTotalMinutes / this.periodTotalWorkouts)
      : 0;
  }

  get averageWorkoutMinutes(): number {
    return this.totalWorkouts ? Math.round(this.totalMinutes / this.totalWorkouts) : 0;
  }

  get runningShare(): number {
    return this.totalWorkouts
      ? Math.round(this.runningWorkouts.length / this.totalWorkouts * 100)
      : 0;
  }

  get strengthShare(): number {
    return this.totalWorkouts
      ? Math.round(this.strengthWorkouts.length / this.totalWorkouts * 100)
      : 0;
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

  formatChartDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `${hours}h${remainingMinutes}m` : `${hours}h`;
  }

  formatPace(secondsPerKm: number | null | undefined): string {
    if (
      secondsPerKm == null ||
      !Number.isFinite(Number(secondsPerKm)) ||
      Number(secondsPerKm) < 0
    ) {
      return '—';
    }

    const totalSeconds = Math.round(Number(secondsPerKm));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private parseDate(value: string): Date | null {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
      return new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3])
      );
    }

    const normalized = value.replace(' ', 'T');
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private startOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private calendarDayNumber(date: Date): number {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }

}

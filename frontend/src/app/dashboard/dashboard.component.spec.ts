import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { WorkoutService } from '../services/workout.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DashboardComponent],
      providers: [
        {
          provide: WorkoutService,
          useValue: { getWorkouts: () => of([]) }
        }
      ]
    });
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows one monthly chart bucket for each day', () => {
    component.setPeriod('monthly');

    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();

    expect(component.activityChart.length).toBe(daysInMonth);
    expect(component.activityChart.map(bucket => bucket.label)).toEqual(
      Array.from({ length: daysInMonth }, (_, index) => String(index + 1))
    );
  });

  it('assigns monthly workout minutes to the matching calendar day', () => {
    const today = new Date();
    const workoutDay = Math.min(today.getDate(), 10);
    component.workouts = [{
      id: 1,
      workout_type_id: 1,
      workout_type: 'Running',
      workout_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(workoutDay).padStart(2, '0')}`,
      duration_minutes: 45,
      notes: null,
      created_at: ''
    }];
    component.setPeriod('monthly');

    expect(component.activityChart[workoutDay - 1].minutes).toBe(45);
  });

  it('keeps all 24 daily hours available with uncluttered six-hour labels', () => {
    component.setPeriod('daily');

    expect(component.activityChart.length).toBe(24);
    expect(component.activityChart.map(bucket => bucket.label)).toEqual([
      '12a', '', '', '', '', '', '6a', '', '', '', '', '', '12p', '',
      '', '', '', '', '6p', '', '', '', '', ''
    ]);
  });

  it('plots running distance as a cumulative monthly total', () => {
    const today = new Date();
    component.workouts = [{
      id: 1,
      workout_type_id: 1,
      workout_type: 'Running',
      workout_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
      duration_minutes: 60,
      notes: null,
      created_at: '',
      running: {
        distance_km: 12,
        avg_pace_seconds_per_km: null,
        avg_heart_rate: null,
        elevation_gain_m: null
      }
    }];

    const points = component.monthlyRunningChart.points;
    expect(points[0].value).toBe(12);
    expect(points[points.length - 1].value).toBe(12);
    expect(points[points.length - 1].day).toBe(today.getDate());
    expect(points.length).toBe(today.getDate());
  });

  it('counts only Sunday-through-today strength sessions and marks Sunday first', () => {
    const today = new Date();
    const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const previousSaturday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - today.getDay() - 1
    );
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const toLocalDate = (date: Date): string =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    component.workouts = [
      {
        id: 1,
        workout_type_id: 2,
        workout_type: 'Strength Training',
        workout_date: toLocalDate(currentDay),
        duration_minutes: 40,
        notes: null,
        created_at: ''
      },
      {
        id: 2,
        workout_type_id: 2,
        workout_type: 'Strength Training',
        workout_date: toLocalDate(previousSaturday),
        duration_minutes: 35,
        notes: null,
        created_at: ''
      },
      {
        id: 3,
        workout_type_id: 1,
        workout_type: 'Running',
        workout_date: toLocalDate(currentDay),
        duration_minutes: 30,
        notes: null,
        created_at: ''
      },
      {
        id: 4,
        workout_type_id: 2,
        workout_type: 'Strength Training',
        workout_date: toLocalDate(currentDay),
        duration_minutes: 25,
        notes: null,
        created_at: ''
      },
      {
        id: 5,
        workout_type_id: 2,
        workout_type: 'Strength Training',
        workout_date: toLocalDate(tomorrow),
        duration_minutes: 25,
        notes: null,
        created_at: ''
      }
    ];

    expect(component.weeklyStrengthDays.map(day => day.label)).toEqual([
      'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'
    ]);
    expect(component.weeklyStrengthDays.map(day => day.completed)).toEqual(
      Array.from({ length: 7 }, (_, index) => index === today.getDay())
    );
    expect(component.weeklyStrengthSessionCount).toBe(2);
  });
});

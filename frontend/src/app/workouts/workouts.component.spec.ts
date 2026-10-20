import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { WorkoutsComponent } from './workouts.component';
import { WorkoutService } from '../services/workout.service';

describe('WorkoutsComponent', () => {
  let component: WorkoutsComponent;
  let fixture: ComponentFixture<WorkoutsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [WorkoutsComponent],
      imports: [CommonModule, FormsModule, RouterTestingModule],
      providers: [
        {
          provide: WorkoutService,
          useValue: {
            getWorkouts: () => of([]),
            getExercises: () => of([])
          }
        }
      ]
    });
    fixture = TestBed.createComponent(WorkoutsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

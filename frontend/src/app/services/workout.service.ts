
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Workout {
  id: number;
  workout_type_id: number;
  workout_type: string;
  workout_date: string;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
}

export interface Exercise {
  id: number;
  exercise_name: string;
  muscle_group: string | null;
  equipment: string | null;
  description: string | null;
}


export interface RunningDetails {
  distance_km: number;
  avg_pace_seconds_per_km: number | null;
  running_duration_seconds?: number | null;
  avg_heart_rate: number | null;
  elevation_gain_m: number | null;
}


export interface StrengthSet {
  reps: number | null;
  weight_kg: number | null;
  duration_minutes: number | null;
}

export interface SavedStrengthSet extends StrengthSet {
  set_id: number;
  set_number: number;
}

export interface StrengthExerciseInput {
  exercise_id: number;
  notes: string;
  sets: StrengthSet[];
}

export interface SavedStrengthExercise {
  strength_exercise_id: number;
  exercise_id: number;
  exercise_name: string;
  muscle_group: string | null;
  equipment: string | null;
  exercise_order: number;
  notes: string | null;
  sets: SavedStrengthSet[];
}

export interface WorkoutDetails extends Workout {
  running?: RunningDetails | null;
  exercises?: SavedStrengthExercise[];
}

export interface CreateWorkout {
  workout_type_id: number;
  workout_date: string;
  duration_minutes: number;
  notes: string;
  running?: RunningDetails;
  exercises?: StrengthExerciseInput[];
}

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private apiUrl = '/api/workouts';
  private exercisesUrl = '/api/exercises';

  constructor(private http: HttpClient) {}

  getWorkouts(): Observable<Workout[]> {
    return this.http.get<Workout[]>(this.apiUrl, {
      withCredentials: true
    });
  }

  getWorkoutById(id: number): Observable<WorkoutDetails> {
    return this.http.get<WorkoutDetails>(`${this.apiUrl}/${id}`, {
      withCredentials: true
    });
  }

  getExercises(): Observable<Exercise[]> {
    return this.http.get<Exercise[]>(this.exercisesUrl, {
      withCredentials: true
    });
  }

  createWorkout(workout: CreateWorkout): Observable<any> {
    return this.http.post(this.apiUrl, workout, {
      withCredentials: true
    });
  }

  updateWorkout(id: number, workout: CreateWorkout): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, workout, {
      withCredentials: true
    });
  }

  deleteWorkout(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, {
      withCredentials: true
    });
  }
}

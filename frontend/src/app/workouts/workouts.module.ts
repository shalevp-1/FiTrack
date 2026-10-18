import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { WorkoutsComponent } from './workouts.component';

const routes: Routes = [
  { path: '', component: WorkoutsComponent }
];

@NgModule({
  declarations: [WorkoutsComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class WorkoutsModule {}

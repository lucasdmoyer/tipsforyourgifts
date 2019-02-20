import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from '../app/home/home.component';
import { BlogComponent } from './blog/blog.component';
import { BlogdetailComponent } from './blogdetail/blogdetail.component';
import { ConsultationFormComponent } from './consultation-form/consultation-form.component';
import { GiftsComponent } from './gifts/gifts.component'

const routes: Routes = [
  { path: '', component: HomeComponent},
  { path: 'blog', component: BlogComponent},
  { path: 'blog/:id', component: BlogdetailComponent},
  { path: 'consultation', component: ConsultationFormComponent},
  { path: 'gifts', component: GiftsComponent}


]


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forRoot(routes, {onSameUrlNavigation: 'reload'})
  ],
  exports: [ RouterModule]
})
export class AppRoutingModule { }

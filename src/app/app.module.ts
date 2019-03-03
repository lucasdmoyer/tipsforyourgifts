import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AngularFireModule } from '@angular/fire';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { AngularFireStorageModule } from '@angular/fire/storage';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { environment } from '../environments/environment';
import { HttpClientModule }    from '@angular/common/http';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { AppRoutingModule } from './app-routing.module';
import { BlogComponent } from './blog/blog.component';
import { BlogdetailComponent } from './blogdetail/blogdetail.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { ConsultationFormComponent } from './consultation-form/consultation-form.component';
import { FormsModule } from '@angular/forms';
import { GiftsComponent } from './gifts/gifts.component';
import { GiftdetailComponent } from './giftdetail/giftdetail.component';
import { MakegiftComponent } from './makegift/makegift.component';


@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    BlogComponent,
    BlogdetailComponent,
    ConsultationFormComponent,
    GiftsComponent,
    GiftdetailComponent,
    MakegiftComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    AngularFireModule.initializeApp(environment.firebase), // imports firebase/app needed for everything
    AngularFirestoreModule, // imports firebase/firestore, only needed for database features
    AngularFireAuthModule, // imports firebase/auth, only needed for auth features,
    AngularFireStorageModule, AppRoutingModule, ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production }) // imports firebase/storage only needed for storage features
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
  
}

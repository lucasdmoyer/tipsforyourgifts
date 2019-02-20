import { Injectable } from '@angular/core';
import { Gift } from './gift';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

 
@Injectable({
  providedIn: 'root'
})
export class GiftsService {
  giftsCollection: AngularFirestoreCollection<Gift>;
  gifts: Observable<Gift[]>
  constructor(afs: AngularFirestore) {
    this.giftsCollection = afs.collection<Gift>('gifts');
    this.gifts = this.giftsCollection.valueChanges();
  }

  getGifts(): Observable<Gift[]> {
    return this.gifts;
  }
}

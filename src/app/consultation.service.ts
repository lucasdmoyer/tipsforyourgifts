import { Injectable } from '@angular/core';
import { Consultation } from './consultation';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from '@angular/fire/firestore';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})

export class ConsultationService {
  requestCollection: AngularFirestoreCollection<Consultation>;
  requests: Observable<Consultation[]>;
  requested: Observable<Consultation>;

  constructor(private afs: AngularFirestore) {
    this.requestCollection = afs.collection<Consultation>('requests');
    this.requests = this.requestCollection.valueChanges();
  }

  addRequst(request: any) {
    this.requestCollection.add(request);
  }


}

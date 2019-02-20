import { Injectable } from '@angular/core';
import { Blog } from './blog';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  blogCollection: AngularFirestoreCollection<Blog>;
  posts: Observable<Blog[]>;

  constructor(private afs: AngularFirestore) {
    this.blogCollection = afs.collection<Blog>('blog');
    this.posts = this.blogCollection.valueChanges();

    
    
  }

  getPosts(): Observable<Blog[]> {
    return this.posts;
    
  }

  getPost(): Observable<Blog[]> {
    return this.posts;
  }
}

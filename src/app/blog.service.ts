import { Injectable } from '@angular/core';
import { Blog } from './blog';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  blogCollection: AngularFirestoreCollection<Blog>;
  reversedBlogCollection: AngularFirestoreCollection<Blog>;
  posts: Observable<Blog[]>;
  reversedPosts: Observable<Blog[]>;

  constructor(private afs: AngularFirestore) {
    this.blogCollection = afs.collection<Blog>('blog', ref=> ref.orderBy('id', 'desc'));
    this.posts = this.blogCollection.valueChanges();

    this.reversedBlogCollection = afs.collection<Blog>('blog', ref=> ref.orderBy('id', "desc"));
    this.reversedPosts = this.reversedBlogCollection.valueChanges();
    
    
  }

  getPosts(): Observable<Blog[]> {
    return this.posts;
  }

  getReversedPosts(): Observable<Blog[]> {
    return this.reversedPosts;
  }

  getPost(): Observable<Blog[]> {
    return this.posts;
  }

  addBlog(request: any) {
    this.blogCollection.add(request);
  }
}

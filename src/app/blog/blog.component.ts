import { Component, OnInit } from '@angular/core';
import { BlogService } from '../blog.service';
import { Blog } from '../blog';
import { Observable, Subject } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.css']
})
export class BlogComponent implements OnInit {
  posts$: Observable<Blog[]>;
  reversedposts$: Observable<Blog[]>;

  constructor(private blogService: BlogService,) {
    this.posts$ = blogService.getPosts();
  }

  ngOnInit() {
    this.getPosts();
  }


  getPosts(): void {
    this.blogService.getPosts().subscribe(posts => {
      console.log(posts)
      console.log("posts gotten!")

    });
    this.posts$ = this.blogService.getPosts();
    
  }

}

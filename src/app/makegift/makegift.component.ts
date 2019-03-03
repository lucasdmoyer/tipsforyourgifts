import { Component, OnInit } from '@angular/core';
import { Blog } from '../blog';
import { Gift } from '../gift';
import { GiftsService } from '../gifts.service';
import { ConsultationService } from '../consultation.service';
import { BlogService } from '../blog.service';

@Component({
  selector: 'app-makegift',
  templateUrl: './makegift.component.html',
  styleUrls: ['./makegift.component.css']
})
export class MakegiftComponent implements OnInit {
  model = new Gift;
  blog = new Blog;
  password: string;
  submitted = false;
  onSubmit() { this.submitted = true; }
  
  constructor(private giftsService: GiftsService, private blogService: BlogService) { }

  ngOnInit() {
  }

  newRequest() {
    if (this.password=="password") {
      this.giftsService.addGift({
        "name":this.model.name,
        "textlink":this.model.textlink,
        "imagelink":this.model.imagelink,
        "textimagelink":this.model.textimagelink,
        "description":this.model.description,
        "imgurl":this.model.imgurl,
        "id":this.model.id,
        
      });
  
      this.blogService.addBlog({
        "title":this.blog.title,
        "post":this.blog.post,
        "description":this.model.description,
        "imgurl":this.model.imgurl,
        "textlink":this.model.textlink,
        "imagelink":this.model.imagelink,
        "id":this.model.id,
      })
    }

    


  }

}

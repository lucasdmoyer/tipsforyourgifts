import { Component, OnInit } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { GiftsService } from '../gifts.service';
import { Gift } from '../gift';


@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  gifts: Gift[];
  featuredGift: Gift;

  constructor(private giftsService: GiftsService) {

  }

  ngOnInit() {
    this.getGifts();
  }

  getGifts(): void {
    this.giftsService.getGifts().subscribe(gifts => {
      this.gifts = gifts;
      this.featuredGift = gifts[0];
    });
      
  }



}

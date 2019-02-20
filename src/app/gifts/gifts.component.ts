import { Component, OnInit } from '@angular/core';
import { GiftsService } from '../gifts.service';
import { Gift } from '../gift';

@Component({
  selector: 'app-gifts',
  templateUrl: './gifts.component.html',
  styleUrls: ['./gifts.component.css']
})
export class GiftsComponent implements OnInit {
  gifts: Gift[];

  constructor(private giftsService: GiftsService) { }

  ngOnInit() {
    this.getGifts();
  }

  getGifts(): void {
    this.giftsService.getGifts().subscribe(gifts => {
      this.gifts = gifts;
    })
  }

}

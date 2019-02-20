import { Component, OnInit } from '@angular/core';
import { Consultation } from '../consultation';
import { ConsultationService} from '../consultation.service';
import { from } from 'rxjs';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-consultation-form',
  templateUrl: './consultation-form.component.html',
  styleUrls: ['./consultation-form.component.css']
})
export class ConsultationFormComponent implements OnInit {
  model = new Consultation(1,"","","","","",false);
  submitted = false;
  onSubmit() { this.submitted = true; }

  constructor(private consultationService: ConsultationService) {

  }

  ngOnInit() {
  }

  newRequest() {
    this.consultationService.addRequst({
      "email":this.model.email,
      "name":this.model.name,
      "ocasion":this.model.ocasion,
      "budget":this.model.budget,
      "request":this.model.request,
      "emaillist":this.model.emaillist,
      "id":this.model.id,
    });
    console.log(this.model)

  }

}

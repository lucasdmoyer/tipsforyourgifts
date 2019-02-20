import { TestBed } from '@angular/core/testing';

import { GiftsService } from './gifts.service';

describe('GiftsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: GiftsService = TestBed.get(GiftsService);
    expect(service).toBeTruthy();
  });
});

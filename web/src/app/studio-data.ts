import { inject, InjectionToken, type Provider } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { Growth, Operations, Strategy } from './content.types';

export interface StudioData {
  operations: Operations;
  strategy: Strategy;
  growth: Growth;
}

export const STUDIO_DATA = new InjectionToken<StudioData>('STUDIO_DATA');

export const STUDIO_DATA_PROVIDER: Provider = {
  provide: STUDIO_DATA,
  useFactory: () => inject(ActivatedRoute).snapshot.data['studioData'] as StudioData
};

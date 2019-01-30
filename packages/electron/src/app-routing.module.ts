import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { routes } from 'app-routing.module';
import { CanDeactivateGuard } from 'services/can-deactivate-guard.service';

import { ElectronPageComponent } from './components/electron/electron.component';


@NgModule({
  imports: [RouterModule.forRoot([{
    path: 'electron/:folder',
    component: ElectronPageComponent,
    canDeactivate: [CanDeactivateGuard],
  }, ...routes])],
  exports: [RouterModule]
})

export class ElectronAppRoutingModule { }

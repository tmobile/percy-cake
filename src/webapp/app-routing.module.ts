import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuardService } from 'services/auth-guard.service';
import { InitGuardService } from 'services/init-guard.service';

import { LayoutComponent } from 'components/layout/layout.component';
import { InitComponent } from 'components/init/init.component';
import { LoginComponent } from 'pages/login/login.component';
import { DashboardComponent } from 'pages/dashboard/dashboard.component';
import { EditorPageComponent } from 'pages/editor/editor.component';
import { CanDeactivateGuard } from 'services/can-deactivate-guard.service';


const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [AuthGuardService],
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuardService],
    children: [
      {
        path: '',
        redirectTo: '/dashboard',
        pathMatch: 'full',
      },
      {
        path: 'init',
        component: InitComponent
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [InitGuardService],
      },
      {
        path: 'files',
        canActivate: [InitGuardService],
        children: [
          {
            path: 'newenv/:appName/:fileName',
            component: EditorPageComponent,
            canDeactivate: [CanDeactivateGuard],
            data: {
              envFileMode: true,
              editMode: false
            }
          },
          {
            path: 'editenv/:appName/:fileName',
            component: EditorPageComponent,
            canDeactivate: [CanDeactivateGuard],
            data: {
              envFileMode: true,
              editMode: true
            }
          },
          {
            path: 'new/:appName',
            component: EditorPageComponent,
            canDeactivate: [CanDeactivateGuard],
            data: {
              editMode: false
            }
          },
          {
            path: 'edit/:appName/:fileName',
            component: EditorPageComponent,
            canDeactivate: [CanDeactivateGuard],
            data: {
              editMode: true
            }
          }
        ]
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})

export class AppRoutingModule { }

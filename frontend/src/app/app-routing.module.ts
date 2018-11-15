import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuardService } from './services/auth-guard.service';

import { LayoutComponent } from './components/layout/layout.component';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { EditorComponent } from './pages/editor/editor.component';
import { CanDeactivateGuard } from './services/can-deactivate-guard.service';


const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
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
        path: 'dashboard',
        component: DashboardComponent
      },
      {
        path: 'files',
        children: [
          {
            path: 'newenv/:appName/:fileName',
            component: EditorComponent,
            canDeactivate: [CanDeactivateGuard],
            data: {
              inEnvMode: true,
              inEditMode: false
            }
          },
          {
            path: 'editenv/:appName/:fileName',
            component: EditorComponent,
            canDeactivate: [CanDeactivateGuard],
            data: {
              inEnvMode: true,
              inEditMode: true
            }
          },
          {
            path: 'new/:appName',
            component: EditorComponent,
            canDeactivate: [CanDeactivateGuard],
            data: {
              inEditMode: false
            }
          },
          {
            path: 'edit/:appName/:fileName',
            component: EditorComponent,
            canDeactivate: [CanDeactivateGuard],
            data: {
              inEditMode: true
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

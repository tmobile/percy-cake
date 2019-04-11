/**
=========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
=========================================================================== 
*/

import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AuthGuardService } from "services/auth-guard.service";
import { InitGuardService } from "services/init-guard.service";

import { LayoutComponent } from "components/layout/layout.component";
import { InitComponent } from "components/init/init.component";
import { LoginComponent } from "pages/login/login.component";
import { DashboardComponent } from "pages/dashboard/dashboard.component";
import { EditorPageComponent } from "pages/editor/editor.component";
import { CanDeactivateGuard } from "services/can-deactivate-guard.service";

export const routes: Routes = [
  {
    path: "login",
    component: LoginComponent,
    canActivate: [AuthGuardService]
  },
  {
    path: "",
    component: LayoutComponent,
    canActivate: [AuthGuardService],
    children: [
      {
        path: "",
        redirectTo: "/dashboard",
        pathMatch: "full"
      },
      {
        path: "init",
        component: InitComponent
      },
      {
        path: "dashboard",
        component: DashboardComponent,
        canActivate: [InitGuardService]
      },
      {
        path: "files",
        canActivate: [InitGuardService],
        children: [
          {
            path: "newenv/:appName/:fileName",
            component: EditorPageComponent,
            canDeactivate: [CanDeactivateGuard],
            data: {
              envFileMode: true,
              editMode: false
            }
          },
          {
            path: "editenv/:appName/:fileName",
            component: EditorPageComponent,
            canDeactivate: [CanDeactivateGuard],
            data: {
              envFileMode: true,
              editMode: true
            }
          },
          {
            path: "new/:appName",
            component: EditorPageComponent,
            canDeactivate: [CanDeactivateGuard],
            data: {
              editMode: false
            }
          },
          {
            path: "edit/:appName/:fileName",
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
    path: "**",
    redirectTo: "/"
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}

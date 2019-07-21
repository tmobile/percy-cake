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
package com.tmobile.percy.editor;

import com.intellij.openapi.fileEditor.FileEditor;
import com.intellij.openapi.fileEditor.FileEditorPolicy;
import com.intellij.openapi.fileEditor.WeighedFileEditorProvider;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.psi.SingleRootFileViewProvider;

/**
 * The percy editor provider.
 *
 * @author TCSCODER
 * @version 1.0
 */
public class PercyEditorProvider extends WeighedFileEditorProvider {

    /**
     * The editor type id.
     */
    private static final String EDITOR_TYPE_ID = "percy-editor";

    /**
     * Get editor type id.
     *
     * @return editor type id
     */
    @Override
    public String getEditorTypeId() {
        return EDITOR_TYPE_ID;
    }

    /**
     * Get editor policy.
     *
     * @return editor policy
     */
    @Override
    public FileEditorPolicy getPolicy() {
        return FileEditorPolicy.PLACE_AFTER_DEFAULT_EDITOR;
    }

    /**
     * Check whether file is accepted.
     *
     * @param project The project
     * @param file    The file
     * @return true if file is accepted; false otherwise
     */
    @Override
    public boolean accept(Project project, VirtualFile file) {
        if (file.isDirectory() || !file.exists() || SingleRootFileViewProvider.isTooLargeForContentLoading(file)) {
            return false;
        }
        // when a project is already disposed due to a slow initialization,
        // reject this file
        if (project.isDisposed()) {
            return false;
        }
        return "yaml".equalsIgnoreCase(file.getExtension()) || "yml".equalsIgnoreCase(file.getExtension());
    }

    /**
     * Create editor.
     *
     * @param project The project
     * @param file    The file
     * @return editor
     */
    @Override
    public FileEditor createEditor(Project project, VirtualFile file) {
        return new PercyEditor(project, file);
    }
}

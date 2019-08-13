/*
 * Copyright (C) 2019 TopCoder Inc., All Rights Reserved.
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
        // reject this file`
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

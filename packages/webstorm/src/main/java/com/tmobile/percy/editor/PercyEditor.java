/*
 * Copyright (C) 2019 TopCoder Inc., All Rights Reserved.
 */
package com.tmobile.percy.editor;

import java.awt.Dimension;
import java.beans.PropertyChangeListener;
import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import javax.swing.JComponent;

import org.jetbrains.annotations.NotNull;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.intellij.codeHighlighting.BackgroundEditorHighlighter;
import com.intellij.ide.ui.LafManager;
import com.intellij.ide.ui.LafManagerListener;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.command.WriteCommandAction;
import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.editor.Document;
import com.intellij.openapi.editor.event.DocumentEvent;
import com.intellij.openapi.editor.event.DocumentListener;
import com.intellij.openapi.fileEditor.FileDocumentManager;
import com.intellij.openapi.fileEditor.FileEditor;
import com.intellij.openapi.fileEditor.FileEditorLocation;
import com.intellij.openapi.fileEditor.FileEditorState;
import com.intellij.openapi.fileEditor.FileEditorStateLevel;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.util.UserDataHolderBase;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.util.ui.UIUtil;
import com.teamdev.jxbrowser.browser.Browser;
import com.teamdev.jxbrowser.frame.Frame;
import com.teamdev.jxbrowser.js.JsAccessible;
import com.teamdev.jxbrowser.js.JsObject;
import com.teamdev.jxbrowser.view.swing.BrowserView;
import com.tmobile.percy.HttpServer;

/**
 * The percy editor.
 *
 * @author TCSCODER
 * @version 1.0
 */
public class PercyEditor extends UserDataHolderBase implements FileEditor {

    /**
     * The logger.
     */
    private static final Logger LOG = Logger.getInstance(PercyEditor.class);

    /**
     * The JSON mapper.
     */
    private static final ObjectMapper mapper = new ObjectMapper();

    /**
     * Project.
     */
    private final Project project;

    /**
     * The file to edit.
     */
    private final VirtualFile file;

    /**
     * The jxbrowser.
     */
    private final Browser browser;

    /**
     * The browser view component.
     */
    private final BrowserView browserView;

    /**
     * The browser frame.
     */
    private final Frame browserFrame;

    /**
     * The Laf listener.
     */
    private final LafChangeListener lafListener;

    /**
     * Whether file is modified.
     */
    private boolean modified;

    /**
     * Constructor.
     *
     * @param project The project
     * @param file    The file to edit
     */
    public PercyEditor(Project project, VirtualFile file) {
        this.project = project;
        this.file = file;

        // create new browser and load html
        browser = PercyEditorComponent.engine.newBrowser();
        browser.navigation().loadUrlAndWait(HttpServer.getStaticUrl("index.html"));

        // get browser frame
        browserFrame = browser.mainFrame().get();

        // inject bridge
        JsObject window = browserFrame.executeJavaScript("window");
        window.putProperty("bridge", new Bridge());

        // update look and feel
        updateLaf();

        // create browser view
        browserView = BrowserView.newInstance(browser);

        // listen on document change event
        Document document = FileDocumentManager.getInstance().getDocument(file);
        if (document != null) {
            document.addDocumentListener(new DocumentListener() {

                @Override
                public void documentChanged(@NotNull final DocumentEvent e) {

                    Map<String, String> send = new HashMap<>();
                    send.put("type", "PercyEditorFileChanged");
                    send.put("fileContent", e.getDocument().getText());
                    try {
                        sendToJS(send);
                    } catch (JsonProcessingException e1) {
                        LOG.error(e);
                    }
                }
            }, this);
        }

        // listen on look and feel change event
        lafListener = new LafChangeListener();
        LafManager.getInstance().addLafManagerListener(lafListener);
    }

    /**
     * Send object to javascript.
     *
     * @param toSend The object to send
     * @throws JsonProcessingException if fails to convert object to JSON
     */
    private void sendToJS(Object toSend) throws JsonProcessingException {
        String toSendStr = mapper.writeValueAsString(toSend);
        JsObject win = browserFrame.executeJavaScript("window");
        win.call("sendMessage", toSendStr);
    }

    /**
     * Update look and feel.
     */
    private void updateLaf() {
        if (UIUtil.isUnderDarcula()) {
            browserFrame.executeJavaScript("document.querySelector('body').classList.add('vscode-dark')");
        } else {
            browserFrame.executeJavaScript("document.querySelector('body').classList.remove('vscode-dark')");
        }
    }

    /**
     * The look and feel change listener.
     */
    private class LafChangeListener implements LafManagerListener {
        @Override
        public void lookAndFeelChanged(LafManager manager) {
            updateLaf();
        }
    }

    /**
     * Dispose.
     */
    @Override
    public void dispose() {
        LafManager.getInstance().removeLafManagerListener(lafListener);
        browser.close();
    }

    /**
     * Get component.
     *
     * @return browser view
     */
    @Override
    public JComponent getComponent() {
        return this.browserView;
    }

    /**
     * Get component to focus.
     *
     * @return browser view
     */
    @Override
    public JComponent getPreferredFocusedComponent() {
        return this.browserView;
    }

    /**
     * Get editor name.
     *
     * @return editor name
     */
    @Override
    public String getName() {
        return "Percy Editor";
    }

    /**
     * Get whether file is modified.
     *
     * @return true if file is modified; false otherwise
     */
    @Override
    public boolean isModified() {
        return modified;
    }

    /**
     * This method is invoked each time when the editor is selected.
     */
    @Override
    public void selectNotify() {
        Dimension size = this.browserView.getSize();

        // Resize to make sure the browser view is shown
        if (size.width > 1 && size.height > 1) {
            this.browser.resize(size.width - 1, size.height - 1);
            this.browser.resize(size.width, size.height);
        }
    }

    /**
     * The init message.
     */
    public static class InitMessage {
        public String type;
        public boolean editMode;
        public boolean envFileMode;
        public String appName;
        public String fileName;
        public String pathSep;
        public String fileContent;
        public String envFileContent;
        public Map<String, Object> percyConfig = new HashMap<>();
        public Map<String, Object> appPercyConfig = new HashMap<>();
    }

    /**
     * The bridge to be called from javascript.
     */
    public class Bridge {

        /**
         * Called by javascript to post message.
         *
         * @param message The message received from javascript.
         * @throws IOException if I/O error occurs
         */
        @JsAccessible
        public void postMessage(JsObject message) throws IOException {

            String type = message.property("type").get().toString();
            LOG.info(type);

            if ("PercyEditorInit".equalsIgnoreCase(type)) {
                // Handle PercyEditorInit event

                String envFileName = "environments.yaml";
                InitMessage send = new InitMessage();
                send.type = "PercyEditorRender";
                send.editMode = true;
                send.envFileMode = envFileName.equals(file.getName());
                send.appName = file.getParent().getPath();
                send.fileName = file.getName();
                send.pathSep = File.separator;
                send.fileContent = new String(file.contentsToByteArray());

                VirtualFile envFile = file.findFileByRelativePath("../" + envFileName);
                if (envFile != null) {
                    send.envFileContent = new String(envFile.contentsToByteArray());
                }

                send.percyConfig.put("variablePrefix", "_{");
                send.percyConfig.put("variableSuffix", "}_");
                send.percyConfig.put("variableNamePrefix", "$");
                send.percyConfig.put("envVariableName", "env");
                send.percyConfig.put("filenameRegex", "^[a-zA-Z0-9_.-]*$");
                send.percyConfig.put("propertyNameRegex", "^[\\s]*[a-zA-Z0-9$_.-]*[\\s]*$");

                VirtualFile parent = file.getParent();
                while (parent != null) {
                    VirtualFile percyConfigFile = parent.findChild(".percyrc");
                    if (percyConfigFile != null) {
                        Map<String, Object> pmap = send.appPercyConfig;
                        @SuppressWarnings("unchecked")
                        Map<String, Object> nmap = mapper.readValue(new String(percyConfigFile.contentsToByteArray()),
                                Map.class);
                        nmap.putAll(pmap);
                        send.appPercyConfig = nmap;
                    }
                    if (parent.getPath().equals(project.getBasePath())) {
                        break;
                    }
                    parent = parent.getParent();
                }

                sendToJS(send);
            } else if ("PercyEditorSave".equalsIgnoreCase(type)) {
                // Handle PercyEditorSave event

                String fileContent = message.property("fileContent").get().toString();
                LOG.info("Save file: " + file.getCanonicalPath());

                ApplicationManager.getApplication().invokeLater(() -> {
                    WriteCommandAction.runWriteCommandAction(project, () -> {
                        FileDocumentManager.getInstance().getDocument(file).setText(fileContent);
                    });
                });

                Map<String, String> send = new HashMap<>();
                send.put("type", "PercyEditorSaved");
                send.put("fileContent", fileContent);
                send.put("newFileName", file.getName());
                sendToJS(send);
            } else if ("PercyEditorFileDirty".equalsIgnoreCase(type)) {
                // Handle PercyEditorFileDirty event

                modified = Boolean.parseBoolean(message.property("dirty").get().toString());
                LOG.info("modified: " + modified);
            }
        }
    }

    /**
     * Dummy method.
     */
    @Override
    public void deselectNotify() {
    }

    /**
     * Dummy method.
     */
    @Override
    public boolean isValid() {
        return true;
    }

    /**
     * Dummy method.
     */
    public FileEditorState getState(@NotNull FileEditorStateLevel level) {
        return FileEditorState.INSTANCE;
    }

    /**
     * Dummy method.
     */
    @Override
    public void setState(FileEditorState state) {
    }

    /**
     * Dummy method.
     */
    @Override
    public void addPropertyChangeListener(PropertyChangeListener listener) {
    }

    /**
     * Dummy method.
     */
    @Override
    public void removePropertyChangeListener(PropertyChangeListener listener) {
    }

    /**
     * Dummy method.
     */
    @Override
    public BackgroundEditorHighlighter getBackgroundHighlighter() {
        return null;
    }

    /**
     * Dummy method.
     */
    @Override
    public FileEditorLocation getCurrentLocation() {
        return null;
    }
}

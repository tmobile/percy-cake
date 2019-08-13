/*
 * Copyright (C) 2019 TopCoder Inc., All Rights Reserved.
 */
package com.tmobile.percy.editor;

import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.beans.PropertyChangeListener;
import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;

import org.jetbrains.annotations.Nullable;
import org.json.JSONObject;

import com.codebrig.journey.JourneyBrowserView;
import com.codebrig.journey.JourneySettings;
import com.codebrig.journey.proxy.CefBrowserProxy;
import com.codebrig.journey.proxy.CefClientProxy;
import com.codebrig.journey.proxy.browser.CefFrameProxy;
import com.codebrig.journey.proxy.browser.CefMessageRouterProxy;
import com.codebrig.journey.proxy.callback.CefQueryCallbackProxy;
import com.codebrig.journey.proxy.handler.CefMessageRouterHandlerProxy;
import com.codebrig.journey.proxy.handler.CefNativeDefault;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.intellij.codeHighlighting.BackgroundEditorHighlighter;
import com.intellij.ide.ui.LafManager;
import com.intellij.ide.ui.LafManagerListener;
import com.intellij.openapi.Disposable;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.command.WriteCommandAction;
import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.editor.event.DocumentEvent;
import com.intellij.openapi.editor.event.DocumentListener;
import com.intellij.openapi.fileEditor.FileDocumentManager;
import com.intellij.openapi.fileEditor.FileEditor;
import com.intellij.openapi.fileEditor.FileEditorLocation;
import com.intellij.openapi.fileEditor.FileEditorState;
import com.intellij.openapi.project.DumbService;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.util.UserDataHolderBase;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.ui.JBColor;
import com.intellij.util.ui.UIUtil;
import com.tmobile.percy.HttpServer;

// import netscape.javascript.JSObject;

/**
 * The percy editor.
 *
 * @author TCSCODER
 * @version 1.0
 */
public class PercyEditor extends UserDataHolderBase implements FileEditor, Disposable {
    /**
     * The logger.
     */
    private static final Logger LOG = Logger.getInstance(PercyEditor.class);

    /**
     * The JSON mapper.
     */
    private static final ObjectMapper mapper = new ObjectMapper();

    /**
     * The JavaFX panel.
     */
    private final JPanel panel = new JPanel(new BorderLayout());

    /**
     * The project.
     */
    private final Project project;

    /**
     * The file to edit.
     */
    private final VirtualFile file;

    /**
     * The browser.
     */
    private static JourneyBrowserView browserView;

    /**
     * The browser.
     */
    private CefClientProxy client;

    /**
     * The browser.
     */
    private CefBrowserProxy browser;

    /**
     * The Message Router Handler
     */
    private CefMessageRouterHandlerProxy handler;

    /**
     * The Message Router
     */
    private CefMessageRouterProxy messageRouter;

    /**
     * Whether file is modified.
     */
    private boolean modified;

    static {
        JourneySettings journeySettings = new JourneySettings();
        journeySettings.setRemoteDebuggingPort(8989);
        browserView = new JourneyBrowserView(journeySettings, JourneyBrowserView.ABOUT_BLANK);
    }

    class MessageRouter extends CefNativeDefault implements CefMessageRouterHandlerProxy {
        @Override
        public boolean onQuery(CefBrowserProxy browser, CefFrameProxy frame, long query_id, String request,
            boolean persistent, CefQueryCallbackProxy callback) {
                try {
                    JSONObject response = handleRequest(new JSONObject(request));
                    callback.success(response.toString());
                    return true;
                } catch (Exception e) {
                    callback.failure(-1, e.toString());
                    return false;
                }
        }

        @Override
        public void onQueryCanceled(CefBrowserProxy browser, CefFrameProxy frame, long query_id) {
            LOG.info("Query cancellted");
        }
    }

    /**
     * The listener to setup look and feel.
     */
    private final LafManagerListener lafListener = (LafManager manager) -> {
        setWebStyle();
    };

    /**
     * Constructor.
     *
     * @param project The project
     * @param file    The file to edit
     */
    public PercyEditor(Project project, VirtualFile file) {
        this.project = project;
        this.file = file;
        DumbService.getInstance(project).smartInvokeLater(() -> {
            this.panel.setBackground(JBColor.background());

            String url = HttpServer.getStaticUrl("index.html");
            LOG.info(url);

            try {
                client = browserView.getCefApp().createClient();
                browser = client.createBrowser(url, false, false);
                panel.add(browser.getUIComponent(), BorderLayout.CENTER);
                messageRouter = CefMessageRouterProxy.create();
                handler = CefMessageRouterHandlerProxy.createHandler(new MessageRouter());
                messageRouter.addHandler(handler, true);
                client.addMessageRouter(messageRouter);
            } catch (Exception e) {
                LOG.error("Error while initialing WebView. ", e);
            }

            // Add look and feel listener
            setWebStyle();

            // Add document change listener
            com.intellij.openapi.editor.Document document = FileDocumentManager.getInstance().getDocument(file);
            if (document != null) {
                document.addDocumentListener(new DocumentListener() {
                    @Override
                    public void documentChanged(final DocumentEvent e) {

                        try {
                            if (browser != null) {
                                Map<String, String> send = new HashMap<>();
                                send.put("type", "PercyEditorFileChanged");
                                send.put("fileContent", e.getDocument().getText());
                                sendToJS(send);
                            }
                        } catch (JsonProcessingException e1) {
                            LOG.error(e);
                        }
                    }
                }, this);
            }
        });
    }

    private JSONObject handleRequest(@Nullable JSONObject message) throws IOException {

        String type = message.getString("type");
        LOG.info(type);

        if ("PercyEditorInit".equalsIgnoreCase(type)) {
            setWebStyle();

            String envFileName = "environments.yaml";
            JSONObject send = new JSONObject();
            send.put("type", "PercyEditorRender");
            send.put("editMode", true);
            send.put("envFileMode", envFileName.equals(file.getName()));
            send.put("appName", file.getParent().getPath());
            send.put("fileName", file.getName());
            send.put("pathSep", File.separator);
            send.put("fileContent", new String(file.contentsToByteArray()));

            VirtualFile envFile = file.findFileByRelativePath("../" + envFileName);
            if (envFile != null) {
                send.put("envFileContent", new String(envFile.contentsToByteArray()));
            }

            JSONObject percyConfig = new JSONObject();
            percyConfig.put("variablePrefix", "_{");
            percyConfig.put("variableSuffix", "}_");
            percyConfig.put("variableNamePrefix", "$");
            percyConfig.put("envVariableName", "env");
            percyConfig.put("filenameRegex", "^[a-zA-Z0-9_.-]*$");
            percyConfig.put("propertyNameRegex", "^[\\s]*[a-zA-Z0-9$_.-]*[\\s]*$");
            send.put("percyConfig", percyConfig);

            VirtualFile parent = file.getParent();
            while (parent != null) {
                VirtualFile percyConfigFile = parent.findChild(".percyrc");
                if (percyConfigFile != null) {
                    JSONObject pmap = new JSONObject();
                    if (send.has("appPercyConfig")) {
                        pmap = send.getJSONObject("appPercyConfig");
                    }
                    JSONObject nmap = new JSONObject(new String(percyConfigFile.contentsToByteArray()));
                    for (String key : JSONObject.getNames(nmap)) {
                        pmap.put(key, nmap.get(key));
                    }
                    send.put("appPercyConfig", nmap);
                }
                if (parent.getPath().equals(project.getBasePath())) {
                    break;
                }
                parent = parent.getParent();
            }

            return send;
        } else if ("PercyEditorSave".equalsIgnoreCase(type)) {
            String fileContent = message.getString("fileContent");
            LOG.info("Save file: " + file.getCanonicalPath());

            WriteCommandAction.runWriteCommandAction(project, () -> {
                FileDocumentManager.getInstance().getDocument(file).setText(fileContent);
            });
            JSONObject send = new JSONObject();
            send.put("type", "PercyEditorSaved");
            send.put("fileContent", fileContent);
            send.put("newFileName", file.getName());
            return send;
        } else if ("PercyEditorFileDirty".equalsIgnoreCase(type)) {
            modified = Boolean.parseBoolean(message.getString("dirty"));
            LOG.info("modified: " + modified);
        }
        return new JSONObject().put("status", "success");
    }

    /**
     * Set web style.
     */
    private void setWebStyle() {
        if (browser != null) {

            String stylesheet = "/default.css";
            if (UIUtil.isUnderDarcula()) {
                stylesheet = "/darcula.css";
            };
            String url = HttpServer.getStaticUrl(stylesheet);
            String JS = "window.injectCss('" + url + "');";
            browser.executeJavaScript(JS, "", 0);
        }
    }

    /**
     * Send message to javascript.
     *
     * @param toSend The message to send
     * @throws JsonProcessingException if JSON error occurs
     */
    private void sendToJS(Object toSend) throws JsonProcessingException {
        String toSendStr = mapper.writeValueAsString(toSend);
        String JS = "window.sendMessage({" +  toSendStr + "});";
        browserView.getCefBrowser().executeJavaScript(JS, "", 0);
    }

    /**
     * Get editor component.
     *
     * @return editor component
     */
    @Override
    public JComponent getComponent() {
        return this.panel;
    }

    /**
     * Get editor component to focus.
     *
     * @return editor component to focus
     */
    @Override
    public JComponent getPreferredFocusedComponent() {
        return this.panel;
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
     * Set preferred width/height of web view when editor is deselected.
     */
    @Override
    public void deselectNotify() {
        if (browser != null && panel != null) {
            // get window width/height
            Component root = SwingUtilities.getRoot(panel);
            if (root == null) {
                return;
            }

            Dimension d = root.getSize();

            Component webView = browser.getUIComponent();

            if (webView == null) {
                return;
            }

            if (d.getWidth() > 0 && d.getHeight() > 0) {
                webView.setPreferredSize(d);
                webView.setSize(d);
                panel.setPreferredSize(d);
                panel.setSize(d);
            }
        }
    }

    /**
     * Dispose this editor.
     */
    @Override
    public void dispose() {
        if (browserView != null) {
            ApplicationManager.getApplication().invokeAndWait(() -> {
                messageRouter.removeHandler(handler);
                client.dispose();
            });
        }
        LafManager.getInstance().removeLafManagerListener(lafListener);
    }

    /**
     * Dummy method.
     */
    @Override
    public void selectNotify() {
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

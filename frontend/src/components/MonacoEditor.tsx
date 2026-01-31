import { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  language?: string;
  placeholder?: string;
  readOnly?: boolean;
}

export default function MonacoEditor({
  value,
  onChange,
  height = '300px',
  language = 'markdown',
  placeholder = '请输入内容...',
  readOnly = false,
}: MonacoEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;

    // 配置编辑器选项
    editor.updateOptions({
      fontSize: 14,
      lineHeight: 24,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', monospace",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      wrappingIndent: 'same',
      lineNumbers: 'off', // 不显示行号
      glyphMargin: false,
      folding: false, // 不显示折叠
      lineDecorationsWidth: 0, // 不显示行装饰
      lineNumbersMinChars: 0,
      renderLineHighlight: 'all',
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      padding: { top: 10, bottom: 10 },
      readOnly,
      // 显示完整工具栏相关选项
      quickSuggestions: true, // 启用快速建议
      suggestOnTriggerCharacters: true, // 触发字符时显示建议
      acceptSuggestionOnCommitCharacter: true, // 提交字符时接受建议
      tabCompletion: 'on', // Tab 键补全
      wordBasedSuggestions: 'matchingDocuments', // 基于单词的建议
      parameterHints: { enabled: true }, // 参数提示
      autoClosingBrackets: 'always', // 自动闭合括号
      autoClosingQuotes: 'always', // 自动闭合引号
      formatOnPaste: true, // 粘贴时格式化
      formatOnType: true, // 输入时格式化
    });

    // 如果有占位符且内容为空，显示占位符
    if (!value && placeholder) {
      const placeholderWidget = {
        getId: () => 'placeholder-widget',
        getDomNode: () => {
          const node = document.createElement('div');
          node.style.color = '#999';
          node.style.fontStyle = 'italic';
          node.style.pointerEvents = 'none';
          node.style.position = 'absolute';
          node.style.top = '10px';
          node.style.left = '10px'; // 调整左边距，因为没有行号了
          node.textContent = placeholder;
          return node;
        },
        getPosition: () => null,
      };
      editor.addOverlayWidget(placeholderWidget);

      // 当内容改变时移除占位符
      editor.onDidChangeModelContent(() => {
        const content = editor.getValue();
        if (content) {
          editor.removeOverlayWidget(placeholderWidget);
        }
      });
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  // 监听主题变化
  useEffect(() => {
    // 监听主题变化
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      if (editorRef.current) {
        monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className="border-2 border-default-200 rounded-lg overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme={isDark ? 'vs-dark' : 'vs'}
        options={{
          automaticLayout: true,
        }}
      />
    </div>
  );
}


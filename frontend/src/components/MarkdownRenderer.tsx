import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          // 自定义代码块样式
          code({ node, inline, className, children, ...props }: any) {
            return inline ? (
              <code
                className="px-1.5 py-0.5 rounded bg-default-100 dark:bg-default-800 text-sm font-mono text-danger"
                {...props}
              >
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // 自定义链接样式
          a({ node, children, ...props }: any) {
            return (
              <a
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
          // 自定义表格样式
          table({ node, children, ...props }: any) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border-collapse border border-default-200" {...props}>
                  {children}
                </table>
              </div>
            );
          },
          th({ node, children, ...props }: any) {
            return (
              <th className="border border-default-200 bg-default-100 dark:bg-default-800 px-4 py-2 text-left font-semibold" {...props}>
                {children}
              </th>
            );
          },
          td({ node, children, ...props }: any) {
            return (
              <td className="border border-default-200 px-4 py-2" {...props}>
                {children}
              </td>
            );
          },
          // 自定义引用块样式
          blockquote({ node, children, ...props }: any) {
            return (
              <blockquote className="border-l-4 border-primary pl-4 py-2 my-4 bg-default-50 dark:bg-default-900/50 italic" {...props}>
                {children}
              </blockquote>
            );
          },
          // 自定义列表样式
          ul({ node, children, ...props }: any) {
            return (
              <ul className="list-disc list-inside space-y-1 my-2" {...props}>
                {children}
              </ul>
            );
          },
          ol({ node, children, ...props }: any) {
            return (
              <ol className="list-decimal list-inside space-y-1 my-2" {...props}>
                {children}
              </ol>
            );
          },
          // 自定义标题样式
          h1({ node, children, ...props }: any) {
            return (
              <h1 className="text-3xl font-bold mt-6 mb-4 text-default-900 dark:text-default-100" {...props}>
                {children}
              </h1>
            );
          },
          h2({ node, children, ...props }: any) {
            return (
              <h2 className="text-2xl font-bold mt-5 mb-3 text-default-900 dark:text-default-100" {...props}>
                {children}
              </h2>
            );
          },
          h3({ node, children, ...props }: any) {
            return (
              <h3 className="text-xl font-bold mt-4 mb-2 text-default-900 dark:text-default-100" {...props}>
                {children}
              </h3>
            );
          },
          // 自定义段落样式
          p({ node, children, ...props }: any) {
            return (
              <p className="my-2 text-default-700 dark:text-default-300 leading-relaxed" {...props}>
                {children}
              </p>
            );
          },
          // 自定义分隔线样式
          hr({ node, ...props }: any) {
            return <hr className="my-6 border-default-200" {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}


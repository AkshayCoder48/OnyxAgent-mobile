/**
 * Lightweight markdown renderer — the native stand-in for the web app's
 * MarkdownContent (react-markdown + remark-gfm): headings, fenced code
 * blocks, blockquotes, ordered/unordered lists, horizontal rules, and the
 * inline grammar (**bold**, *italic*, `code`, [links](url)).
 *
 * Deliberately dependency-free: assistant answers arrive as plain markdown
 * text over the streaming wire and render with the app's own palette.
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; level: number; text: string }
  | { type: 'code'; lang: string; code: string }
  | { type: 'quote'; text: string }
  | { type: 'li'; ordered: boolean; text: string; indent: boolean; index: number }
  | { type: 'hr' };

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let listIndex = 0;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'p', text: paragraph.join('\n') });
      paragraph = [];
    }
    listIndex = 0;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block
    if (trimmed.startsWith('```')) {
      flushParagraph();
      const lang = trimmed.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (or EOF)
      blocks.push({ type: 'code', lang, code: body.join('\n') });
      continue;
    }

    // Blank line
    if (trimmed.length === 0) {
      flushParagraph();
      i += 1;
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({ type: 'h', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    // Blockquote (greedy over consecutive quoted lines)
    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        body.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: body.join(' ') });
      continue;
    }

    // Unordered list item
    const ul = /^(\s*)[-*•]\s+(.*)$/.exec(line);
    if (ul) {
      flushParagraph();
      listIndex += 1;
      blocks.push({ type: 'li', ordered: false, text: ul[2], indent: ul[1].length >= 2, index: listIndex });
      i += 1;
      continue;
    }

    // Ordered list item
    const ol = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      flushParagraph();
      listIndex += 1;
      blocks.push({ type: 'li', ordered: true, text: ol[2], indent: ol[1].length >= 2, index: listIndex });
      i += 1;
      continue;
    }

    paragraph.push(trimmed);
    i += 1;
  }
  flushParagraph();
  return blocks;
}

// ---------------------------------------------------------------------------
// Inline parsing
// ---------------------------------------------------------------------------

type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'italic'; v: string }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; href: string };

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  let i = 0;

  const pushText = () => {
    if (buffer.length > 0) {
      out.push({ t: 'text', v: buffer });
      buffer = '';
    }
  };

  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpExecArray | null;

    if ((m = /^`([^`]+)`/.exec(rest))) {
      pushText();
      out.push({ t: 'code', v: m[1] });
      i += m[0].length;
      continue;
    }
    if ((m = /^\*\*([^*]+)\*\*/.exec(rest)) || (m = /^__([^_]+)__/.exec(rest))) {
      pushText();
      out.push({ t: 'bold', v: m[1] });
      i += m[0].length;
      continue;
    }
    if ((m = /^\*([^*\n]+)\*/.exec(rest)) || (m = /^_([^_\n]+)_/.exec(rest))) {
      pushText();
      out.push({ t: 'italic', v: m[1] });
      i += m[0].length;
      continue;
    }
    if ((m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest))) {
      pushText();
      out.push({ t: 'link', v: m[1], href: m[2] });
      i += m[0].length;
      continue;
    }

    buffer += src[i];
    i += 1;
  }
  pushText();
  return out;
}

function InlineText({ src, color }: { src: string; color: string }): ReactNode {
  const { colors, fonts } = useTheme();
  const parts = parseInline(src);
  return (
    <Text style={{ color }}>
      {parts.map((part, index) => {
        switch (part.t) {
          case 'bold':
            return (
              <Text key={index} style={{ fontFamily: fonts.sansSemibold, fontWeight: '600' }}>
                {part.v}
              </Text>
            );
          case 'italic':
            return (
              <Text key={index} style={{ fontStyle: 'italic' }}>
                {part.v}
              </Text>
            );
          case 'code':
            return (
              <Text
                key={index}
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 13,
                  color: colors.primary,
                  backgroundColor: colors.accent,
                  paddingHorizontal: 4,
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                {part.v}
              </Text>
            );
          case 'link':
            return (
              <Text
                key={index}
                style={{ color: colors.primary, textDecorationLine: 'underline' }}
                onPress={() => {
                  Linking.openURL(part.href).catch(() => undefined);
                }}
              >
                {part.v}
              </Text>
            );
          default:
            return <Text key={index}>{part.v}</Text>;
        }
      })}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function Markdown({ text }: { text: string }) {
  const { colors, fonts } = useTheme();
  const blocks = useMemo(() => parseBlocks(text), [text]);
  const [expandedCode, setExpandedCode] = useState<Record<number, boolean>>({});

  return (
    <View style={styles.stack}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'h': {
            const size = block.level <= 1 ? 22 : block.level === 2 ? 19 : 16.5;
            return (
              <Text
                key={index}
                style={{
                  fontFamily: fonts.sansBold,
                  fontSize: size,
                  lineHeight: size * 1.3,
                  color: colors.foreground,
                  marginTop: index === 0 ? 0 : 12,
                }}
              >
                {block.text}
              </Text>
            );
          }
          case 'code':
            return (
              <View
                key={index}
                style={[styles.codeBlock, { backgroundColor: colors.chatCodeBg, borderColor: colors.border }]}
              >
                <View style={styles.codeHeader}>
                  <Text style={[styles.codeLang, { color: colors.mutedForeground }]}>
                    {block.lang.length > 0 ? block.lang : 'code'}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 12.5,
                    lineHeight: 19,
                    color: colors.chatCodeFg,
                  }}
                  numberOfLines={expandedCode[index] ? undefined : 14}
                  ellipsizeMode="tail"
                >
                  {block.code}
                </Text>
                {block.code.split('\n').length > 14 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setExpandedCode((prev) => ({ ...prev, [index]: !prev[index] }))}
                    hitSlop={8}
                  >
                    <Text style={[styles.codeExpand, { color: colors.primary }]}>
                      {expandedCode[index] ? 'Show less' : 'Show all'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          case 'quote':
            return (
              <View
                key={index}
                style={[styles.quote, { borderLeftColor: colors.accentMuted, paddingLeft: 10 }]}
              >
                <Text style={{ color: colors.mutedForeground, fontStyle: 'italic', fontSize: 14, lineHeight: 21 }}>
                  <InlineText src={block.text} color={colors.mutedForeground} />
                </Text>
              </View>
            );
          case 'li': {
            const marker = block.ordered ? `${block.index}.` : '•';
            return (
              <View
                key={index}
                style={[styles.listRow, { paddingLeft: block.indent ? 28 : 0 }]}
              >
                <Text style={{ color: colors.primary, fontFamily: fonts.mono, fontSize: 13, lineHeight: 22 }}>
                  {marker}
                </Text>
                <Text style={{ flex: 1, color: colors.foreground, fontSize: 15, lineHeight: 22 }}>
                  <InlineText src={block.text} color={colors.foreground} />
                </Text>
              </View>
            );
          }
          case 'hr':
            return <View key={index} style={[styles.hr, { backgroundColor: colors.border }]} />;
          default:
            return (
              <Text key={index} style={{ color: colors.foreground, fontSize: 15, lineHeight: 23 }}>
                <InlineText src={block.text} color={colors.foreground} />
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  codeBlock: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  codeLang: {
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: undefined,
  },
  codeExpand: { fontSize: 12, marginTop: 6, fontWeight: '600' },
  quote: {
    borderLeftWidth: 3,
    paddingVertical: 2,
  },
  listRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  hr: { height: 1, marginVertical: 4 },
});

/** Re-exported for callers that only need plain-text-ish preview (sidebar
 *  snippets strip markdown syntax so previews read cleanly). */
export function markdownToPlain(src: string): string {
  return src
    .replace(/```[\s\S]*?```/g, ' code ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^(\s*)[-*•]\s+/gm, '$1')
    .replace(/^(\s*)\d+[.)]\s+/gm, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

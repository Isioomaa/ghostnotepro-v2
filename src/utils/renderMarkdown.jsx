import React from 'react';

/**
 * Converts markdown bold/italic syntax to React elements.
 * Handles **bold**, *italic*, and ***bold italic*** patterns.
 */
export function renderMarkdown(text) {
    if (!text || typeof text !== 'string') return text;

    // Split by markdown patterns and convert to React elements
    const parts = [];
    let remaining = text;
    let key = 0;

    // Process bold+italic (***text***), bold (**text**), and italic (*text*)
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(remaining)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            parts.push(remaining.slice(lastIndex, match.index));
        }

        if (match[2]) {
            // ***bold italic***
            parts.push(<strong key={key++}><em>{match[2]}</em></strong>);
        } else if (match[3]) {
            // **bold**
            parts.push(<strong key={key++}>{match[3]}</strong>);
        } else if (match[4]) {
            // *italic*
            parts.push(<em key={key++}>{match[4]}</em>);
        }

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < remaining.length) {
        parts.push(remaining.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
}

/**
 * Renders a block of text with markdown formatting and paragraph breaks.
 * Splits on double newlines for paragraphs, renders markdown within each.
 */
export function renderMarkdownBlock(text, className = '') {
    if (!text || typeof text !== 'string') return text;

    const paragraphs = text.split(/\n\n+/);

    return paragraphs.map((para, idx) => {
        // Handle single newlines within paragraphs
        const lines = para.split(/\n/);
        return (
            <p key={idx} className={className} style={idx > 0 ? { marginTop: '0.75em' } : undefined}>
                {lines.map((line, lineIdx) => (
                    <React.Fragment key={lineIdx}>
                        {lineIdx > 0 && <br />}
                        {renderMarkdown(line)}
                    </React.Fragment>
                ))}
            </p>
        );
    });
}

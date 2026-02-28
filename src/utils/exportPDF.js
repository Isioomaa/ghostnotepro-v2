/**
 * GhostNotePro PDF Export
 * Generates a branded PDF from Scribe/Strategist output using window.print()
 */

export function exportToPDF(data, mode = 'scribe', options = {}) {
    const { transcript, analysis, industry } = options;

    // Determine content based on mode
    const isStrategist = mode === 'strategist';
    const freeData = data.free_tier || (data.core_thesis ? data : null);
    const proData = data.pro_tier || (data.judgment || data.executive_judgement ? data : null);

    const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    // Build content sections
    let contentHTML = '';

    if (!isStrategist && freeData) {
        // Scribe output
        if (freeData.core_thesis) {
            contentHTML += `
                <div class="section">
                    <h2 class="section-label">CORE THESIS</h2>
                    <p class="thesis">"${escapeHTML(freeData.core_thesis)}"</p>
                </div>
            `;
        }

        if (freeData.strategic_pillars && freeData.strategic_pillars.length > 0) {
            contentHTML += `
                <div class="section">
                    <h2 class="section-label">STRATEGIC PILLARS</h2>
                    ${freeData.strategic_pillars.map(pillar => `
                        <div class="pillar">
                            <h3 class="pillar-title">${escapeHTML(pillar.title)}</h3>
                            <p class="pillar-desc">${escapeHTML(pillar.rich_description || pillar.description)}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (freeData.tactical_steps && freeData.tactical_steps.length > 0) {
            contentHTML += `
                <div class="section tactical">
                    <h2 class="section-label">TACTICAL ROADMAP</h2>
                    <ol class="steps">
                        ${freeData.tactical_steps.map(step => `
                            <li>${escapeHTML(step)}</li>
                        `).join('')}
                    </ol>
                </div>
            `;
        }
    } else if (isStrategist && proData) {
        // Strategist output
        if (proData.judgment || proData.executive_judgement) {
            contentHTML += `
                <div class="section">
                    <h2 class="section-label">EXECUTIVE JUDGMENT</h2>
                    <p class="judgment">${formatMarkdown(proData.judgment || proData.executive_judgement)}</p>
                </div>
            `;
        }

        if (proData.riskAudit || proData.risk_audit) {
            contentHTML += `
                <div class="section risk">
                    <h2 class="section-label risk-label">RISK AUDIT</h2>
                    <div class="risk-box">
                        <p>${formatMarkdown(proData.riskAudit || proData.risk_audit)}</p>
                    </div>
                </div>
            `;
        }

        if (proData.emailDraft || proData.email_draft) {
            const rawEmail = proData.emailDraft || proData.email_draft;
            let subject = "No Subject";
            let body = "";

            if (typeof rawEmail === 'string') {
                const parts = rawEmail.split('\n\n');
                if (parts.length > 0) {
                    subject = parts[0].replace(/^SUBJECT:\s*/i, '');
                    body = parts.slice(1).join('\n\n');
                } else {
                    body = rawEmail;
                }
            } else if (rawEmail && typeof rawEmail === 'object') {
                subject = rawEmail.subject;
                body = rawEmail.body;
            }

            contentHTML += `
                <div class="section email">
                    <h2 class="section-label">DRAFTED COMMUNICATION</h2>
                    <div class="email-box">
                        <p class="email-subject-label">SUBJECT</p>
                        <p class="email-subject">${escapeHTML(subject)}</p>
                        <p class="email-body-label">MESSAGE BODY</p>
                        <p class="email-body">${escapeHTML(body)}</p>
                    </div>
                </div>
            `;
        }
    }

    // Metadata bar
    let metaHTML = '';
    if (analysis) {
        metaHTML = `
            <div class="meta-bar">
                <span>DURATION: <strong>${analysis.duration || 'N/A'}</strong></span>
                <span>INTENSITY: <strong class="${analysis.intensity === 'High' ? 'high' : ''}">${analysis.intensity || 'Medium'}</strong></span>
                <span>STATE: <em>${analysis.executive_state || analysis.tone || 'Reflective'}</em></span>
                ${industry ? `<span>INDUSTRY: <strong>${escapeHTML(industry)}</strong></span>` : ''}
            </div>
        `;
    }

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>GhostNote Pro — ${isStrategist ? 'Strategic Brief' : 'Executive Synthesis'}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400&display=swap');
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            @page {
                size: A4;
                margin: 0;
            }
            
            body {
                background: #0A0A0A;
                color: #F0F0F0;
                font-family: 'Inter', -apple-system, sans-serif;
                padding: 60px;
                min-height: 100vh;
            }
            
            .container {
                max-width: 680px;
                margin: 0 auto;
            }
            
            /* Header */
            .header {
                border-bottom: 2px solid #D4AF37;
                padding-bottom: 24px;
                margin-bottom: 40px;
            }
            
            .brand-bar {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                margin-bottom: 16px;
            }
            
            .brand-name {
                font-family: 'Inter', sans-serif;
                font-size: 9px;
                font-weight: 700;
                letter-spacing: 0.3em;
                text-transform: uppercase;
                color: #D4AF37;
            }
            
            .date {
                font-size: 9px;
                letter-spacing: 0.15em;
                color: #666;
            }
            
            .doc-type {
                font-family: 'Playfair Display', serif;
                font-size: 28px;
                font-weight: 700;
                color: #D4AF37;
                margin-bottom: 8px;
            }

            .classification {
                font-size: 9px;
                letter-spacing: 0.2em;
                text-transform: uppercase;
                color: #666;
            }
            
            /* Meta bar */
            .meta-bar {
                display: flex;
                gap: 24px;
                font-size: 10px;
                letter-spacing: 0.1em;
                color: #888;
                background: #111;
                padding: 12px 16px;
                border: 1px solid #222;
                margin-bottom: 36px;
            }
            
            .meta-bar strong { color: #F0F0F0; }
            .meta-bar em { color: #D4AF37; font-style: italic; }
            .meta-bar .high { color: #EF4444; }
            
            /* Sections */
            .section { margin-bottom: 36px; }
            
            .section-label {
                font-size: 9px;
                font-weight: 700;
                letter-spacing: 0.3em;
                text-transform: uppercase;
                color: #D4AF37;
                margin-bottom: 16px;
            }
            
            .risk-label { color: #EF4444; }
            
            .thesis {
                font-family: 'Playfair Display', serif;
                font-size: 22px;
                font-weight: 700;
                line-height: 1.4;
                color: #FFFFFF;
            }
            
            .judgment {
                font-size: 16px;
                font-weight: 500;
                line-height: 1.7;
                color: #E0E0E0;
            }
            
            .judgment strong { color: #D4AF37; }
            .judgment em { color: #CCCCCC; }
            
            /* Pillars */
            .pillar {
                border-left: 2px solid rgba(212, 175, 55, 0.3);
                padding-left: 20px;
                margin-bottom: 20px;
            }
            
            .pillar-title {
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                margin-bottom: 6px;
                color: #FFFFFF;
            }
            
            .pillar-desc {
                font-size: 14px;
                line-height: 1.7;
                color: #AAAAAA;
            }
            
            /* Tactical */
            .tactical {
                background: #111;
                border-top: 2px solid #D4AF37;
                padding: 24px;
            }
            
            .steps {
                list-style: none;
                counter-reset: steps;
            }
            
            .steps li {
                counter-increment: steps;
                display: flex;
                align-items: flex-start;
                margin-bottom: 12px;
                font-size: 13px;
                line-height: 1.6;
                color: #CCCCCC;
            }
            
            .steps li::before {
                content: counter(steps, decimal-leading-zero);
                font-family: 'JetBrains Mono', monospace;
                font-size: 10px;
                font-weight: 700;
                color: #D4AF37;
                margin-right: 12px;
                min-width: 20px;
                margin-top: 3px;
            }
            
            /* Risk */
            .risk-box {
                background: rgba(127, 29, 29, 0.15);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-left: 3px solid #EF4444;
                padding: 20px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 11px;
                line-height: 1.8;
                color: #F87171;
            }
            
            .risk-box strong { color: #FCA5A5; }
            
            /* Email */
            .email-box {
                background: #111;
                border: 1px solid #222;
                padding: 24px;
            }
            
            .email-subject-label, .email-body-label {
                font-size: 9px;
                letter-spacing: 0.2em;
                color: #555;
                margin-bottom: 4px;
            }
            
            .email-body-label { margin-top: 20px; }
            
            .email-subject {
                font-weight: 700;
                font-size: 15px;
                color: #FFFFFF;
                margin-bottom: 8px;
            }
            
            .email-body {
                font-size: 13px;
                line-height: 1.8;
                color: #AAAAAA;
                white-space: pre-wrap;
            }
            
            /* Footer */
            .footer {
                margin-top: 48px;
                padding-top: 20px;
                border-top: 1px solid #222;
                text-align: center;
            }
            
            .footer p {
                font-size: 9px;
                letter-spacing: 0.15em;
                color: #444;
            }
            
            .footer .brand {
                color: #D4AF37;
                font-weight: 700;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <header class="header">
                <div class="brand-bar">
                    <span class="brand-name">GhostNote Pro</span>
                    <span class="date">${date}</span>
                </div>
                <h1 class="doc-type">${isStrategist ? 'Strategic Intelligence Brief' : 'Executive Synthesis'}</h1>
                <p class="classification">${isStrategist ? 'STRATEGIST OUTPUT • CLASSIFIED' : 'SCRIBE OUTPUT • EXECUTIVE GRADE'}</p>
            </header>
            
            ${metaHTML}
            ${contentHTML}
            
            <footer class="footer">
                <p>Generated by <span class="brand">GhostNote Pro</span> — Executive Voice Intelligence</p>
                <p style="margin-top: 4px;">ghostnotepro.com</p>
            </footer>
        </div>
    </body>
    </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for fonts to load then print
    printWindow.onload = () => {
        setTimeout(() => {
            printWindow.print();
            // Close after a delay to allow print dialog
            printWindow.onafterprint = () => printWindow.close();
        }, 500);
    };
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatMarkdown(text) {
    if (!text) return '';
    return escapeHTML(text)
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

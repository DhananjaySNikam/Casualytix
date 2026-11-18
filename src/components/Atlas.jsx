import React, { useState } from 'react';
import { ArrowUpRight, Download, Code2, BookOpen } from 'lucide-react';
import atlas from '../atlas.json';
import { PageHead, Modal } from './Ui';
import { count } from '../api';
export const notionReport =
  'https://app.notion.com/p/CAUSALYTIX-Project-Report-Diagram-Atlas-41c3502181d78100893ddb122e49401a';
export default function Atlas() {
  const [selected, pick] = useState(null);
  return (
    <>
      <PageHead
        eyebrow="ENGINEERING REFERENCES"
        title="Diagram library"
        subtitle="The system design, diagnostic methods, and data model behind Causalytix."
      >
        <a className="btn secondary" href="/assets/causalytix-diagram-atlas.pdf" download>
          <Download size={15} />
          Atlas PDF
        </a>
        <a className="btn secondary" href={notionReport} target="_blank" rel="noreferrer">
          <BookOpen size={15} />
          Notion report
          <ArrowUpRight size={13} />
        </a>
      </PageHead>
      <div className="atlas-grid">
        {atlas.map((item, i) => (
          <button key={item.id} className="atlas-card" onClick={() => pick(item)}>
            <div className="atlas-art">
              <img loading="lazy" src={`/assets/atlas/${item.id}.svg`} alt="" />
              <span>FIG. {count(i + 1)}</span>
            </div>
            <div>
              <small className="eyebrow muted-text">{item.group}</small>
              <h3>
                {item.title}
                <ArrowUpRight size={15} />
              </h3>
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <Modal
          title={selected.title}
          kicker={'FIG. ' + selected.id.slice(0, 2) + ' / ' + selected.group.toUpperCase()}
          wide
          close={() => pick(null)}
        >
          <div className="modal-body">
            <div className="atlas-large">
              <img src={`/assets/atlas/${selected.id}.svg`} alt={selected.title + ' diagram'} />
            </div>
            <p className="body-copy">{selected.description}</p>
            <div className="dialog-actions">
              <a className="btn secondary" href={`/assets/atlas/${selected.id}.mmd`} download>
                <Code2 size={14} />
                Mermaid source
              </a>
              <a className="btn primary" href={`/assets/atlas/${selected.id}.svg`} download>
                <Download size={14} />
                Download SVG
              </a>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

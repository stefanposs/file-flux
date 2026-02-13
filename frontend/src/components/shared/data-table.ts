/**
 * <ff-data-table> — Wiederverwendbare Datentabelle mit Sortierung.
 *
 * Generische Tabelle, die mit beliebigen Daten und Spaltendefinitionen
 * arbeitet. Reduziert Codeduplizierung in den Listenansichten.
 *
 * @example
 *   <ff-data-table
 *     .columns=${[
 *       { key: 'name', label: 'Name', sortable: true },
 *       { key: 'status', label: 'Status' },
 *     ]}
 *     .data=${this.agents}
 *     @row-click=${(e) => this._navigate(`/agents/${e.detail.row.id}`)}
 *   ></ff-data-table>
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, row: any) => unknown;
}

@customElement('ff-data-table')
export class DataTable extends LitElement {
  @property({ type: Array }) columns: TableColumn[] = [];
  @property({ type: Array }) data: any[] = [];
  @property({ type: Boolean }) clickable = false;

  @state() private sortKey = '';
  @state() private sortDir: 'asc' | 'desc' = 'asc';

  static styles = css`
    :host {
      display: block;
    }

    .table-container {
      background: var(--ff-surface, #fff);
      border-radius: var(--ff-radius-lg, 12px);
      border: 1px solid var(--ff-border, #e5e7eb);
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      text-align: left;
      padding: 12px 16px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ff-gray-500, #6b7280);
      background: var(--ff-gray-50, #f9fafb);
      border-bottom: 1px solid var(--ff-border, #e5e7eb);
      user-select: none;
    }

    th.sortable {
      cursor: pointer;
      transition: color var(--ff-transition, 0.2s ease);
    }

    th.sortable:hover {
      color: var(--ff-primary, #4f46e5);
    }

    th .sort-icon {
      display: inline-block;
      width: 12px;
      margin-left: 4px;
      opacity: 0.4;
    }

    th.sorted .sort-icon {
      opacity: 1;
      color: var(--ff-primary, #4f46e5);
    }

    td {
      padding: 12px 16px;
      font-size: 14px;
      color: var(--ff-gray-700, #374151);
      border-bottom: 1px solid var(--ff-gray-100, #f3f4f6);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr.clickable {
      cursor: pointer;
      transition: background var(--ff-transition, 0.2s ease);
    }

    tr.clickable:hover {
      background: var(--ff-gray-50, #f9fafb);
    }
  `;

  render() {
    const sortedData = this._getSortedData();

    return html`
      <div class="table-container">
        <table>
          <thead>
            <tr>
              ${this.columns.map(col => html`
                <th
                  class="${col.sortable ? 'sortable' : ''} ${this.sortKey === col.key ? 'sorted' : ''}"
                  style="${col.width ? `width: ${col.width}` : ''}"
                  @click=${col.sortable ? () => this._toggleSort(col.key) : null}
                >
                  ${col.label}
                  ${col.sortable ? html`
                    <span class="sort-icon">${this.sortKey === col.key ? (this.sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  ` : ''}
                </th>
              `)}
            </tr>
          </thead>
          <tbody>
            ${sortedData.map(row => html`
              <tr
                class="${this.clickable ? 'clickable' : ''}"
                @click=${this.clickable ? () => this._handleRowClick(row) : null}
              >
                ${this.columns.map(col => html`
                  <td>${col.render ? col.render(row[col.key], row) : row[col.key]}</td>
                `)}
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  private _toggleSort(key: string) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
  }

  private _getSortedData(): any[] {
    if (!this.sortKey) return [...this.data];
    return [...this.data].sort((a, b) => {
      const aVal = a[this.sortKey] ?? '';
      const bVal = b[this.sortKey] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), 'de');
      return this.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  private _handleRowClick(row: any) {
    this.dispatchEvent(new CustomEvent('row-click', {
      detail: { row },
      bubbles: true,
      composed: true,
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ff-data-table': DataTable;
  }
}

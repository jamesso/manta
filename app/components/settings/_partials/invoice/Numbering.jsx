import React from 'react';
import {
  normalizeNumbering,
  formatInvoiceNumber,
} from '../../../../helpers/numbering';
import { Section } from '../../../shared/Section';
import { Part, Row, Field } from '../../../shared/Part';
export default function Numbering({ numbering, onChange, t }) {
  const value = normalizeNumbering(numbering);
  return (
    <Section>
      <label className="itemLabel">{t('form:numbering:title')}</label>
      <Part>
        <Row>
          {['prefix', 'next', 'padding'].map(name => (
            <Field key={name}>
              <label className="itemLabel" htmlFor={`numbering-${name}`}>
                {t(`form:numbering:${name}`)}
              </label>
              <input
                id={`numbering-${name}`}
                type={name === 'prefix' ? 'text' : 'number'}
                min={name === 'next' ? 1 : 0}
                max={name === 'padding' ? 12 : undefined}
                value={numbering?.[name] ?? value[name]}
                onChange={e =>
                  onChange({
                    ...value,
                    [name]:
                      name === 'prefix'
                        ? e.target.value
                        : Number(e.target.value),
                  })
                }
              />
            </Field>
          ))}
        </Row>
        <p>
          {t('form:numbering:sample', { number: formatInvoiceNumber(value) })}
        </p>
      </Part>
    </Section>
  );
}

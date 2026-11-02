import React from 'react';
import { render, screen } from '@testing-library/react';

import {
  PageWrapper,
  PageHeader,
  PageHeaderTitle,
  PageHeaderActions,
  PageContent,
  PageFooter,
} from '../Layout';

describe('Renders its children element', () => {
  it('PageWrapper renders its children', () => {
    render(
      <PageWrapper>
        <div>Hello, World</div>
      </PageWrapper>
    );
    expect(screen.getByText('Hello, World')).toBeInTheDocument();
  });

  it('PageHeader renders its children', () => {
    render(
      <PageHeader>
        <div>Hello, World</div>
      </PageHeader>
    );
    expect(screen.getByText('Hello, World')).toBeInTheDocument();
  });

  it('PageHeaderTitle renders a DIV element', () => {
    render(
      <PageHeaderTitle>
        <span>Hello, World</span>
      </PageHeaderTitle>
    );
    expect(screen.getByText('Hello, World')).toBeInTheDocument();
  });

  it('PageHeaderActions renders its children', () => {
    render(
      <PageHeaderActions>
        <div>Hello, World</div>
      </PageHeaderActions>
    );
    expect(screen.getByText('Hello, World')).toBeInTheDocument();
  });

  it('PageContent renders its children', () => {
    render(
      <PageContent>
        <div>Hello, World</div>
      </PageContent>
    );
    expect(screen.getByText('Hello, World')).toBeInTheDocument();
  });

  it('PageFooter renders its children', () => {
    render(
      <PageFooter>
        <div>Hello, World</div>
      </PageFooter>
    );
    expect(screen.getByText('Hello, World')).toBeInTheDocument();
  });
});

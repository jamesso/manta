import React, { Component } from 'react';
import i18n from '../../../i18n/i18n';
import { Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  componentDidCatch(error, info) {
    this.setState({ hasError: true, error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-svh flex-col items-center justify-center gap-4 bg-background p-8 text-center">
          <Bug className="size-12 text-destructive" aria-hidden />
          <h1 className="text-lg font-semibold">{i18n.t('app:error:title')}</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {i18n.t('app:error:message')}
          </p>
          {this.state.info?.componentStack && (
            <details className="max-w-xl text-start text-xs text-muted-foreground">
              <summary>{i18n.t('app:error:details')}</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">
                {this.state.info.componentStack}
              </pre>
            </details>
          )}
          <Button type="button" onClick={() => window.location.reload()}>
            {i18n.t('app:error:reload')}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

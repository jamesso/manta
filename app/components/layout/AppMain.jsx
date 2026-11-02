import React, { Component } from 'react';
import PropTypes from 'prop-types';

import Form from '../../containers/Form';
import Dashboard from '../../containers/Dashboard';
import Invoices from '../../containers/Invoices';
import Contacts from '../../containers/Contacts';
import Settings from '../../containers/Settings';

class AppMain extends Component {
  shouldComponentUpdate(nextProps) {
    return this.props.activeTab !== nextProps.activeTab;
  }

  render() {
    const { activeTab } = this.props;
    return (
      <div className="h-full overflow-auto bg-background">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'form' && <Form />}
        {activeTab === 'invoices' && <Invoices />}
        {activeTab === 'contacts' && <Contacts />}
        {activeTab === 'settings' && <Settings />}
      </div>
    );
  }
}

AppMain.propTypes = {
  activeTab: PropTypes.string.isRequired,
};

export default AppMain;

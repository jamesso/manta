import React from 'react';
import PropTypes from 'prop-types';
import { AnimatePresence, motion } from 'motion/react';

function TransitionList({ children, componentHeight }) {
  return (
    <div>
      <AnimatePresence>
        {React.Children.map(children, child => (
          <motion.div
            key={child.key}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: componentHeight, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

TransitionList.propTypes = {
  children: PropTypes.arrayOf(PropTypes.element).isRequired,
  componentHeight: PropTypes.number.isRequired,
};

export default TransitionList;

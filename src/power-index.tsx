/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Entry point for the Power menu item. Each cockpit menu entry maps to its own
 * HTML file and bundle -- the pattern cockpit's own `systemd` package uses for
 * Overview / Services / Logs from a single package.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

import "cockpit-dark-theme";

import { PowerPage } from './power.jsx';

import "patternfly/patternfly-6-cockpit.scss";
import './app.scss';

document.addEventListener("DOMContentLoaded", () => {
    createRoot(document.getElementById("app")!).render(<PowerPage />);
});

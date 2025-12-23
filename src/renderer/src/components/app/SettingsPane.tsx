import React from 'react';
import { Button } from '../ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';

const SettingsPane = () => {
  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold">Settings</h3>
        <p className="text-sm text-muted-foreground">Local preferences for SSH, security, and UI</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { title: 'Host Key Policy', description: 'Choose strict or accept-new behavior for known hosts.' },
          { title: 'Session Defaults', description: 'Default shell size, fonts, and session timeouts.' },
          { title: 'Security', description: 'Lock screen, local encryption, and audit logs.' },
          { title: 'Tooling', description: 'Manage MCP tools and local integrations.' }
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SettingsPane;

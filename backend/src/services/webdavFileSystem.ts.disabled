import { v2 as webdav } from 'webdav-server';
import { Pool } from 'pg';
import { CalDAVService } from './caldavService';
import logger from '../utils/logger';

export class CalDAVFileSystem extends webdav.FileSystem {
  private caldavService: CalDAVService;
  private db: Pool;

  constructor(database: Pool) {
    super();
    this.db = database;
    this.caldavService = new CalDAVService(database);
  }

  // Directory operations

  async _readDir(path: webdav.Path, ctx: webdav.RequestContext, callback: webdav.ReturnCallback<string[]>): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      logger.debug(`Reading directory: ${pathStr} for user ${user.id}`);

      // Root path: return user's calendars
      if (pathStr === '/' || pathStr === '') {
        const calendars = await this.caldavService.getCalendars(user.id);
        const children = calendars
          .filter(cal => cal.webdavEnabled)
          .map(cal => cal.id);
        return callback(null, children);
      }

      // Calendar path: return calendar objects
      const pathParts = pathStr.split('/').filter(p => p);
      if (pathParts.length === 1) {
        const calendarId = pathParts[0];
        const objects = await this.caldavService.getCalendarObjects(calendarId, user.id);
        const children = objects.map(obj => `${obj.id}.ics`);
        return callback(null, children);
      }

      // Invalid path
      callback(webdav.Errors.ResourceNotFound);
    } catch (error) {
      logger.error('Error reading directory:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }

  async _type(path: webdav.Path, ctx: webdav.RequestContext, callback: webdav.ReturnCallback<webdav.ResourceType>): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      // Root is always a directory
      if (pathStr === '/' || pathStr === '') {
        return callback(null, webdav.ResourceType.Directory);
      }

      const pathParts = pathStr.split('/').filter(p => p);

      // Calendar collection
      if (pathParts.length === 1) {
        const calendarId = pathParts[0];
        const calendar = await this.caldavService.getCalendar(calendarId, user.id);
        if (calendar && calendar.webdavEnabled) {
          return callback(null, webdav.ResourceType.Directory);
        }
        return callback(webdav.Errors.ResourceNotFound);
      }

      // Calendar object (.ics file)
      if (pathParts.length === 2 && pathParts[1].endsWith('.ics')) {
        const calendarId = pathParts[0];
        const objectId = pathParts[1].replace('.ics', '');
        const object = await this.caldavService.getCalendarObject(calendarId, objectId, user.id);
        if (object) {
          return callback(null, webdav.ResourceType.File);
        }
        return callback(webdav.Errors.ResourceNotFound);
      }

      callback(webdav.Errors.ResourceNotFound);
    } catch (error) {
      logger.error('Error getting resource type:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }

  async _exists(path: webdav.Path, ctx: webdav.RequestContext, callback: webdav.SimpleCallback): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      // Root always exists
      if (pathStr === '/' || pathStr === '') {
        return callback();
      }

      const pathParts = pathStr.split('/').filter(p => p);

      // Calendar collection
      if (pathParts.length === 1) {
        const calendarId = pathParts[0];
        const calendar = await this.caldavService.getCalendar(calendarId, user.id);
        if (calendar && calendar.webdavEnabled) {
          return callback();
        }
        return callback(webdav.Errors.ResourceNotFound);
      }

      // Calendar object
      if (pathParts.length === 2 && pathParts[1].endsWith('.ics')) {
        const calendarId = pathParts[0];
        const objectId = pathParts[1].replace('.ics', '');
        const object = await this.caldavService.getCalendarObject(calendarId, objectId, user.id);
        if (object) {
          return callback();
        }
        return callback(webdav.Errors.ResourceNotFound);
      }

      callback(webdav.Errors.ResourceNotFound);
    } catch (error) {
      logger.error('Error checking existence:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }

  // File operations

  async _readFile(path: webdav.Path, ctx: webdav.RequestContext, callback: webdav.ReturnCallback<Buffer>): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      const pathParts = pathStr.split('/').filter(p => p);

      // Only calendar objects can be read as files
      if (pathParts.length === 2 && pathParts[1].endsWith('.ics')) {
        const calendarId = pathParts[0];
        const objectId = pathParts[1].replace('.ics', '');
        
        const object = await this.caldavService.getCalendarObject(calendarId, objectId, user.id);
        if (object) {
          return callback(null, Buffer.from(object.icalendarData, 'utf8'));
        }
      }

      callback(webdav.Errors.ResourceNotFound);
    } catch (error) {
      logger.error('Error reading file:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }

  async _writeFile(path: webdav.Path, data: Buffer, ctx: webdav.RequestContext, callback: webdav.SimpleCallback): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      const pathParts = pathStr.split('/').filter(p => p);

      // Only calendar objects can be written
      if (pathParts.length === 2 && pathParts[1].endsWith('.ics')) {
        const calendarId = pathParts[0];
        const objectId = pathParts[1].replace('.ics', '');
        const icalendarData = data.toString('utf8');

        // Check if object exists
        const existingObject = await this.caldavService.getCalendarObject(calendarId, objectId, user.id);
        
        if (existingObject) {
          // Update existing object
          await this.caldavService.updateCalendarObject(calendarId, objectId, user.id, icalendarData);
        } else {
          // Create new object
          await this.caldavService.createCalendarObject(calendarId, user.id, icalendarData);
        }

        return callback();
      }

      callback(webdav.Errors.Forbidden);
    } catch (error) {
      logger.error('Error writing file:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }

  async _delete(path: webdav.Path, ctx: webdav.RequestContext, callback: webdav.SimpleCallback): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      const pathParts = pathStr.split('/').filter(p => p);

      // Delete calendar object
      if (pathParts.length === 2 && pathParts[1].endsWith('.ics')) {
        const calendarId = pathParts[0];
        const objectId = pathParts[1].replace('.ics', '');
        
        await this.caldavService.deleteCalendarObject(calendarId, objectId, user.id);
        return callback();
      }

      // Delete calendar collection
      if (pathParts.length === 1) {
        const calendarId = pathParts[0];
        await this.caldavService.deleteCalendar(calendarId, user.id);
        return callback();
      }

      callback(webdav.Errors.Forbidden);
    } catch (error) {
      logger.error('Error deleting resource:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }

  async _create(path: webdav.Path, ctx: webdav.RequestContext, callback: webdav.SimpleCallback): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      const pathParts = pathStr.split('/').filter(p => p);

      // Create calendar collection
      if (pathParts.length === 1) {
        const calendarName = pathParts[0];
        await this.caldavService.createCalendar(user.id, {
          name: calendarName,
          displayName: calendarName
        });
        return callback();
      }

      callback(webdav.Errors.Forbidden);
    } catch (error) {
      logger.error('Error creating resource:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }

  // Property operations

  async _readProperty(path: webdav.Path, propertyName: webdav.PropertyName, ctx: webdav.RequestContext, callback: webdav.ReturnCallback<string>): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      const property = await this.caldavService.getProperty(pathStr, propertyName.namespace, propertyName.name);
      if (property) {
        return callback(null, property.value || '');
      }

      // Handle built-in properties
      const pathParts = pathStr.split('/').filter(p => p);

      if (propertyName.name === 'resourcetype') {
        if (pathParts.length <= 1) {
          return callback(null, '<D:collection/>');
        } else {
          return callback(null, '');
        }
      }

      if (propertyName.name === 'getcontenttype' && pathParts.length === 2 && pathParts[1].endsWith('.ics')) {
        return callback(null, 'text/calendar; charset=utf-8');
      }

      if (propertyName.name === 'getetag' && pathParts.length === 2 && pathParts[1].endsWith('.ics')) {
        const calendarId = pathParts[0];
        const objectId = pathParts[1].replace('.ics', '');
        const object = await this.caldavService.getCalendarObject(calendarId, objectId, user.id);
        if (object) {
          return callback(null, `"${object.etag}"`);
        }
      }

      callback(webdav.Errors.PropertyNotFound);
    } catch (error) {
      logger.error('Error reading property:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }

  async _writeProperty(path: webdav.Path, propertyName: webdav.PropertyName, value: string, ctx: webdav.RequestContext, callback: webdav.SimpleCallback): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      await this.caldavService.setProperty(pathStr, propertyName.namespace, propertyName.name, value);
      callback();
    } catch (error) {
      logger.error('Error writing property:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }

  async _removeProperty(path: webdav.Path, propertyName: webdav.PropertyName, ctx: webdav.RequestContext, callback: webdav.SimpleCallback): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      await this.caldavService.removeProperty(pathStr, propertyName.namespace, propertyName.name);
      callback();
    } catch (error) {
      logger.error('Error removing property:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }

  // Size operations

  async _size(path: webdav.Path, ctx: webdav.RequestContext, callback: webdav.ReturnCallback<number>): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      const pathParts = pathStr.split('/').filter(p => p);

      // Calendar object size
      if (pathParts.length === 2 && pathParts[1].endsWith('.ics')) {
        const calendarId = pathParts[0];
        const objectId = pathParts[1].replace('.ics', '');
        
        const object = await this.caldavService.getCalendarObject(calendarId, objectId, user.id);
        if (object) {
          return callback(null, Buffer.byteLength(object.icalendarData, 'utf8'));
        }
      }

      callback(webdav.Errors.ResourceNotFound);
    } catch (error) {
      logger.error('Error getting size:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }

  // Date operations

  async _lastModifiedDate(path: webdav.Path, ctx: webdav.RequestContext, callback: webdav.ReturnCallback<number>): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      const pathParts = pathStr.split('/').filter(p => p);

      // Calendar collection
      if (pathParts.length === 1) {
        const calendarId = pathParts[0];
        const calendar = await this.caldavService.getCalendar(calendarId, user.id);
        if (calendar) {
          return callback(null, calendar.updatedAt.getTime());
        }
      }

      // Calendar object
      if (pathParts.length === 2 && pathParts[1].endsWith('.ics')) {
        const calendarId = pathParts[0];
        const objectId = pathParts[1].replace('.ics', '');
        
        const object = await this.caldavService.getCalendarObject(calendarId, objectId, user.id);
        if (object) {
          return callback(null, object.updatedAt.getTime());
        }
      }

      callback(webdav.Errors.ResourceNotFound);
    } catch (error) {
      logger.error('Error getting last modified date:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }

  async _creationDate(path: webdav.Path, ctx: webdav.RequestContext, callback: webdav.ReturnCallback<number>): Promise<void> {
    try {
      const pathStr = path.toString();
      const user = (ctx as any).user;

      if (!user) {
        return callback(webdav.Errors.Forbidden);
      }

      const pathParts = pathStr.split('/').filter(p => p);

      // Calendar collection
      if (pathParts.length === 1) {
        const calendarId = pathParts[0];
        const calendar = await this.caldavService.getCalendar(calendarId, user.id);
        if (calendar) {
          return callback(null, calendar.createdAt.getTime());
        }
      }

      // Calendar object
      if (pathParts.length === 2 && pathParts[1].endsWith('.ics')) {
        const calendarId = pathParts[0];
        const objectId = pathParts[1].replace('.ics', '');
        
        const object = await this.caldavService.getCalendarObject(calendarId, objectId, user.id);
        if (object) {
          return callback(null, object.createdAt.getTime());
        }
      }

      callback(webdav.Errors.ResourceNotFound);
    } catch (error) {
      logger.error('Error getting creation date:', error);
      callback(webdav.Errors.InternalServerError);
    }
  }
}
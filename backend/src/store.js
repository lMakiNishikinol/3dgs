const fs = require('fs');
const path = require('path');
const config = require('./config');

const DATA_DIR = path.resolve(__dirname, '..', config.DATA_DIR);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

class StoreDataError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StoreDataError';
    this.cause = cause;
  }
}

// 本地原型使用的 JSON 集合。写入采用“临时文件 + 原子替换”，避免进程中断留下半个 JSON。
// 该实现仅面向单 Node.js 进程；生产环境仍应迁移到具备事务和外键的数据库。
class Collection {
  constructor(name) {
    this.name = name;
    this.file = path.join(DATA_DIR, name + '.json');
    this.items = this._load();
    this._assertUniqueIds(this.items);
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const value = JSON.parse(raw);
      if (!Array.isArray(value)) throw new Error('根节点必须是数组');
      return value;
    } catch (error) {
      if (error && error.code === 'ENOENT') return [];
      throw new StoreDataError('无法读取数据集合 ' + this.name + ': ' + error.message, error);
    }
  }

  _assertUniqueIds(items) {
    const seen = new Set();
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id) {
        throw new StoreDataError('数据集合 ' + this.name + ' 中存在无效 id');
      }
      if (seen.has(item.id)) throw new StoreDataError('数据集合 ' + this.name + ' 中存在重复 id: ' + item.id);
      seen.add(item.id);
    }
  }

  _save() {
    this._assertUniqueIds(this.items);
    const temporaryFile = this.file + '.' + process.pid + '.tmp';
    let descriptor;
    try {
      descriptor = fs.openSync(temporaryFile, 'w');
      fs.writeFileSync(descriptor, JSON.stringify(this.items, null, 2) + '\n', 'utf8');
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      fs.renameSync(temporaryFile, this.file);
    } catch (error) {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      try { fs.unlinkSync(temporaryFile); } catch { /* ignore cleanup failure */ }
      throw new StoreDataError('无法保存数据集合 ' + this.name + ': ' + error.message, error);
    }
  }

  all() { return [...this.items]; }
  find(predicate) { return this.items.filter(predicate); }
  findById(id) { return this.items.find((item) => item.id === id) || null; }
  findOne(predicate) { return this.items.find(predicate) || null; }

  insert(object) {
    if (!object || typeof object.id !== 'string' || !object.id) {
      throw new StoreDataError('写入数据集合 ' + this.name + ' 时 id 不能为空');
    }
    if (this.findById(object.id)) throw new StoreDataError('数据集合 ' + this.name + ' 已存在 id: ' + object.id);
    this.items.push(object);
    this._save();
    return object;
  }

  upsert(object) {
    const existing = object && this.findById(object.id);
    if (!existing) return this.insert(object);
    return this.update(object.id, object);
  }

  update(id, patch) {
    const item = this.findById(id);
    if (!item) return null;
    if (patch && patch.id !== undefined && patch.id !== id) {
      throw new StoreDataError('不能修改数据集合 ' + this.name + ' 的主键 id');
    }
    Object.assign(item, patch, { id });
    this._save();
    return item;
  }

  remove(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index < 0) return false;
    this.items.splice(index, 1);
    this._save();
    return true;
  }

  paginate(items, page = 1, pageSize = 20) {
    const size = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 50);
    const current = Math.max(parseInt(page, 10) || 1, 1);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const start = (current - 1) * size;
    return {
      items: items.slice(start, start + size),
      page: current,
      pageSize: size,
      total,
      totalPages,
      hasNext: current < totalPages,
    };
  }
}

const users = new Collection('users');
const products = new Collection('products');
const uploads = new Collection('uploads');
const modelingJobs = new Collection('modelingJobs');
const models = new Collection('models');
const orders = new Collection('orders');
const notifications = new Collection('notifications');
const comments = new Collection('comments');
const favorites = new Collection('favorites');

module.exports = {
  DATA_DIR,
  StoreDataError,
  Collection,
  users,
  products,
  uploads,
  modelingJobs,
  models,
  orders,
  notifications,
  comments,
  favorites,
};

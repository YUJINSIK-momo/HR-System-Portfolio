import { Router } from 'express';
import { authenticate, requirePasswordChanged, requireRole } from '../middleware/auth';
import { getTasks, createTask, updateTask, deleteTask, getAssignableUsers } from '../controllers/schedule.controller';
import { getProjects, createProject, updateProject, deleteProject } from '../controllers/schedule-project.controller';
import {
  listPersonalTodos,
  createPersonalTodo,
  updatePersonalTodo,
  deletePersonalTodo,
} from '../controllers/schedule-personal-todo.controller';

const router = Router();

/** 스케줄 관리: DESIGNER, MANAGER, SUPER_ADMIN(대표) 접근 가능 */
const requireDesignerOrManagerOrRep = requireRole('DESIGNER', 'MANAGER', 'SUPER_ADMIN');

router.use(authenticate, requirePasswordChanged, requireDesignerOrManagerOrRep);

router.get('/assignable-users', getAssignableUsers);
router.get('/projects', getProjects);
router.post('/projects', createProject);
router.patch('/projects/:id', updateProject);
router.delete('/projects/:id', deleteProject);

router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.patch('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);

router.get('/personal-todos', listPersonalTodos);
router.post('/personal-todos', createPersonalTodo);
router.patch('/personal-todos/:id', updatePersonalTodo);
router.delete('/personal-todos/:id', deletePersonalTodo);

export default router;

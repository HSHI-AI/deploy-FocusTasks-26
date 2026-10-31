import { id, shiftedDate, localDate, type LearningTask, type LearningSession, type Priority, type TaskStatus } from './types';

const session = (title: string, estimatedMinutes = 60, done = false, actualMinutes = done ? estimatedMinutes : 0): LearningSession => ({
  id: id(), title, estimatedMinutes, actualMinutes, done,
  completedAt: done ? shiftedDate(-3) : null, notes: '', resourceUrl: ''
});

function task(title: string, category: string, priority: Priority, status: TaskStatus,
  deadline: string | null, sessions: LearningSession[], extras: Partial<LearningTask> = {}): LearningTask {
  return {
    id: id(), title, category, priority, status, deadline,
    description: '', resourceUrl: '', resourceLabel: '', resourceNote: '',
    plannedMinutes: 600, sessions, completedAt: status === 'completed' ? shiftedDate(-5) : null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...extras
  };
}

export function demoTasks(): LearningTask[] {
  return [
    task('Python for Finance', 'Quant · Book study', 1, 'active', shiftedDate(30), [
      session('Ch 8 — Financial time series: returns', 60, true, 80),
      session('Ch 8 — Rolling statistics', 60, true, 65),
      session('Ch 8 — Volatility analysis'),
      session('Ch 11 — Mathematical tools', 90),
      session('Ch 12 — Random number generation'),
      session('Ch 12 — Monte Carlo simulation', 90),
      session('Ch 13 — Portfolio optimization', 90),
      session('Ch 15 — ML trading strategies', 90),
      session('Ch 15 — Backtesting exercise', 60),
      session('Research notes and summary', 60)
    ], { description: 'Complete the most relevant chapters and build practical financial data skills.', resourceUrl: 'https://github.com/yhilpisch/py4fi2nd', resourceLabel: 'Official code', resourceNote: 'O’Reilly, 2nd edition' }),
    task('Probability & Statistics', 'Math · Foundation', 2, 'active', shiftedDate(45), [
      session('Conditional probability & Bayes', 60, true, 75),
      session('Random variables and distributions'),
      session('Expectation, variance, covariance'),
      session('Maximum likelihood estimation'),
      session('Hypothesis testing & confidence intervals'),
      session('Bootstrap and statistical inference')
    ], { resourceNote: 'Blitzstein & Hwang — selected chapters' }),
    task('101 Formulaic Alphas', 'Quant · Research project', 3, 'active', shiftedDate(72), [
      session('Read the paper and identify data requirements'),
      session('Implement the first price-based alpha'),
      session('Implement a volume-based alpha'),
      session('Implement a volatility-based alpha'),
      session('Run point-in-time validation'),
      session('Evaluate costs, IC and Sharpe'),
      session('Write research report', 120)
    ], { resourceUrl: 'https://arxiv.org/abs/1601.00991', resourceLabel: 'Research paper', resourceNote: 'Zura Kakushadze, 2016' }),
    task('Analysis of Financial Time Series', 'Quant · Book study', 2, 'backlog', null, [], {
      plannedMinutes: 50 * 60, resourceNote: 'Ruey S. Tsay — financial returns, ARMA, GARCH', resourceLabel: 'Book notes'
    }),
    task('Advances in Financial Machine Learning', 'Quant · Book study', 2, 'backlog', null, [], {
      plannedMinutes: 40 * 60, resourceNote: 'Marcos López de Prado — validation & backtesting', resourceLabel: 'Reading list'
    }),
    task('Quant Interview Green Book', 'Interview practice', 3, 'backlog', null, [], {
      plannedMinutes: 30 * 60, resourceNote: 'A Practical Guide to Quantitative Finance Interviews', resourceLabel: 'Practice problems'
    }),
    task('Linear Algebra Primer', 'Math · Reference', 3, 'backlog', null, [], {
      plannedMinutes: 20 * 60, resourceNote: 'Dan Stefanica — review as needed'
    }),
    task('Job Search Skills', 'Career · Training', 2, 'completed', shiftedDate(-5), [
      session('Target jobs according to goals and aspirations', 60, true, 65),
      session('Understand the hidden job market', 60, true, 58),
      session('Create a focused job search plan', 60, true, 75)
    ], { description: 'Example completed task. You can delete or edit any demo item.', completedAt: shiftedDate(-5) })
  ];
}

export const emptyTask = (status: TaskStatus = 'backlog'): LearningTask => ({
  id: id(), title: '', category: 'Self study', priority: 2, status, deadline: status === 'active' ? localDate() : null,
  description: '', resourceUrl: '', resourceLabel: '', resourceNote: '',
  plannedMinutes: 60, completedAt: null, sessions: [],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
});

package com.lushprojects.circuitjs1.client.module;

public class LinearAlgebra {
	// factors a matrix into upper and lower triangular matrices by
	// gaussian elimination.  On entry, a[0..n-1][0..n-1] is the
	// matrix to be factored.  ipvt[] returns an integer vector of pivot
	// indices, used in the lu_solve() routine.
	public static boolean lu_factor(double a[][], int n, int ipvt[]) {
		int i,j,k;
		// check for a possible singular matrix by scanning for rows that are all zeroes
		for (i = 0; i != n; i++) {
			boolean row_all_zeros = true;
			for (j = 0; j != n; j++) {
				if (a[i][j] != 0) {
					row_all_zeros = false;
					break;
				}
			}
			if (row_all_zeros)
				return false;
		}

		// use Crout's method; loop through the columns
		for (j = 0; j != n; j++) {
			// calculate upper triangular elements for this column
			for (i = 0; i != j; i++) {
				double q = a[i][j];
				for (k = 0; k != i; k++)
					q -= a[i][k]*a[k][j];
				a[i][j] = q;
			}
			// calculate lower triangular elements for this column
			double largest = 0;
			int largestRow = -1;
			for (i = j; i != n; i++) {
				double q = a[i][j];
				for (k = 0; k != j; k++)
					q -= a[i][k]*a[k][j];
				a[i][j] = q;
				double x = Math.abs(q);
				if (x >= largest) {
					largest = x;
					largestRow = i;
				}
			}
			// pivoting
			if (j != largestRow) {
				if (largestRow == -1) {
					return false;
				}
				double x;
				for (k = 0; k != n; k++) {
					x = a[largestRow][k];
					a[largestRow][k] = a[j][k];
					a[j][k] = x;
				}
			}
			// keep track of row interchanges
			ipvt[j] = largestRow;
			// check for zeroes; if we find one, it's a singular matrix.
			if (a[j][j] == 0.0) {
				return false;
			}
			if (j != n-1) {
				double mult = 1.0/a[j][j];
				for (i = j+1; i != n; i++)
					a[i][j] *= mult;
			}
		}
		return true;
	}

	// Solves the set of n linear equations using a LU factorization
	// previously performed by lu_factor.  On input, b[0..n-1] is the right
	// hand side of the equations, and on output, contains the solution.
	public static void lu_solve(double a[][], int n, int ipvt[], double b[]) {
		int i;
		// find first nonzero b element
		for (i = 0; i != n; i++) {
			int row = ipvt[i];
			double swap = b[row];
			b[row] = b[i];
			b[i] = swap;
			if (swap != 0)
				break;
		}
		int bi = i++;
		for (; i < n; i++) {
			int row = ipvt[i];
			int j;
			double tot = b[row];
			b[row] = b[i];
			// forward substitution using the lower triangular matrix
			for (j = bi; j < i; j++)
				tot -= a[i][j]*b[j];
			b[i] = tot;
		}
		for (i = n-1; i >= 0; i--) {
			double tot = b[i];
			int j;
			// back-substitution using the upper triangular matrix
			for (j = i+1; j != n; j++)
				tot -= a[i][j]*b[j];
			b[i] = tot/a[i][i];
		}
	}

	public static void invertMatrix(double a[][], int n) {
		int ipvt[] = new int[n];
		lu_factor(a, n, ipvt);
		int i, j;
		double b[] = new double[n];
		double inva[][] = new double[n][n];
		// solve for each column of identity matrix
		for (i = 0; i != n; i++) {
			for (j = 0; j != n; j++)
				b[j] = 0;
			b[i] = 1;
			lu_solve(a, n, ipvt, b);
			for (j = 0; j != n; j++)
				inva[j][i] = b[j];
		}
		// return in original matrix
		for (i = 0; i != n; i++)
			for (j = 0; j != n; j++)
				a[i][j] = inva[i][j];
	}
} 
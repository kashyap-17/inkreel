# Intermediate files (.aux .bbl .log ...) go to build/; the PDF stays next to
# the .tex. Applies to CLI latexmk and VSCode LaTeX Workshop alike.
#
# Usage:  latexmk Kashyap_3087617_Literature_Review.tex
$aux_dir = 'build';
$pdf_mode = 1;   # pdflatex

# bibtex runs with cwd = build/, so point BIBINPUTS at this directory, where
# the Zotero-exported references.bib lives.
use Cwd 'abs_path';
use File::Basename;
my $here = dirname(abs_path(__FILE__));
$ENV{'BIBINPUTS'} = "$here:" . ($ENV{'BIBINPUTS'} // '');
